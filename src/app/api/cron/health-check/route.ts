import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { Endpoint } from "@/lib/types";

const DEGRADED_RESPONSE_TIME_MS = 2000;
const ALERT_TIMEOUT_MS = 10000;

type CheckResult = {
  endpoint_id: string;
  status: "up" | "down" | "degraded";
  response_time_ms: number | null;
  alert_errors?: string[];
};

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Health check cron error: CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Cron secret is not configured" },
      { status: 500 }
    );
  }

  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("endpoints")
    .select("*")
    .eq("is_active", true);

  if (error) {
    console.error("Health check cron error: failed to fetch endpoints", error);
    return NextResponse.json(
      { error: "Failed to fetch endpoints" },
      { status: 500 }
    );
  }

  const endpoints = (data ?? []) as Endpoint[];
  const settledResults = await Promise.allSettled(
    endpoints.map((endpoint) => checkEndpoint(endpoint))
  );
  const results = settledResults.map((result, index) => {
    if (result.status === "fulfilled") return result.value;

    console.error(
      `Health check failed for endpoint ${endpoints[index].id}:`,
      result.reason
    );
    return {
      endpoint_id: endpoints[index].id,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Health check processing failed",
    };
  });
  const checked = settledResults.filter(
    (result) => result.status === "fulfilled"
  ).length;

  return NextResponse.json({
    total: endpoints.length,
    checked,
    failed: endpoints.length - checked,
    results,
  });
}

async function checkEndpoint(endpoint: Endpoint): Promise<CheckResult> {
  let lastError: string | null = null;
  let statusCode: number | null = null;
  let responseTimeMs: number | null = null;
  let status: CheckResult["status"] = "down";

  for (let attempt = 0; attempt <= endpoint.retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      endpoint.timeout_ms
    );
    const startedAt = performance.now();

    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: endpoint.headers ?? {},
        body:
          endpoint.method !== "GET" &&
          endpoint.method !== "HEAD" &&
          endpoint.body
            ? endpoint.body
            : undefined,
        signal: controller.signal,
      });

      responseTimeMs = Math.round(performance.now() - startedAt);
      statusCode = response.status;

      if (response.status === endpoint.expected_status) {
        status =
          responseTimeMs > DEGRADED_RESPONSE_TIME_MS ? "degraded" : "up";
        lastError = null;
        break;
      }

      lastError = `Expected ${endpoint.expected_status}, got ${response.status}`;
    } catch (error: unknown) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? `Request timed out after ${endpoint.timeout_ms}ms`
          : error instanceof Error
            ? error.message
            : "Unknown error";
    } finally {
      clearTimeout(timeout);
    }
  }

  const { error: checkError } = await supabaseAdmin
    .from("health_checks")
    .insert({
      endpoint_id: endpoint.id,
      status,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      error_message: lastError,
    });

  if (checkError) {
    throw new Error(`Failed to record health check: ${checkError.message}`);
  }

  await handleIncidents(endpoint.id, status, lastError);
  const alertErrors =
    status === "down" ? await triggerAlerts(endpoint.id, lastError) : [];

  return {
    endpoint_id: endpoint.id,
    status,
    response_time_ms: responseTimeMs,
    ...(alertErrors.length > 0 ? { alert_errors: alertErrors } : {}),
  };
}

async function handleIncidents(
  endpointId: string,
  status: CheckResult["status"],
  errorMessage: string | null
) {
  const { data: openIncident, error: lookupError } = await supabaseAdmin
    .from("incidents")
    .select("id")
    .eq("endpoint_id", endpointId)
    .neq("status", "resolved")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up open incident: ${lookupError.message}`);
  }

  if (status === "down" && !openIncident) {
    const { data: incident, error: insertError } = await supabaseAdmin
      .from("incidents")
      .insert({
        endpoint_id: endpointId,
        title: `Endpoint down: ${errorMessage || "Connection failed"}`,
        status: "investigating",
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create incident: ${insertError.message}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("incident_updates")
      .insert({
        incident_id: incident.id,
        status: "investigating",
        message: `Endpoint went down. Error: ${errorMessage || "Unknown"}`,
      });

    if (updateError) {
      throw new Error(`Failed to record incident update: ${updateError.message}`);
    }
  } else if (status === "up" && openIncident) {
    const { error: resolveError } = await supabaseAdmin
      .from("incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", openIncident.id);

    if (resolveError) {
      throw new Error(`Failed to resolve incident: ${resolveError.message}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from("incident_updates")
      .insert({
        incident_id: openIncident.id,
        status: "resolved",
        message: "Endpoint recovered and is now responding normally.",
      });

    if (updateError) {
      throw new Error(`Failed to record incident update: ${updateError.message}`);
    }
  }
}

async function triggerAlerts(
  endpointId: string,
  errorMessage: string | null
): Promise<string[]> {
  const { data: alerts, error: alertsError } = await supabaseAdmin
    .from("alert_configs")
    .select("*")
    .eq("endpoint_id", endpointId)
    .eq("is_active", true);

  if (alertsError) {
    throw new Error(`Failed to fetch alert configs: ${alertsError.message}`);
  }
  if (!alerts?.length) return [];

  const { data: endpoint, error: endpointError } = await supabaseAdmin
    .from("endpoints")
    .select("name, url")
    .eq("id", endpointId)
    .single();

  if (endpointError) {
    throw new Error(`Failed to fetch endpoint for alerts: ${endpointError.message}`);
  }

  const alertErrors: string[] = [];

  for (const alert of alerts) {
    if (alert.type === "webhook") {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        ALERT_TIMEOUT_MS
      );

      try {
        const response = await fetch(alert.target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "endpoint.down",
            endpoint: endpoint.name,
            url: endpoint.url,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          alertErrors.push(
            `Webhook alert returned HTTP ${response.status} for endpoint ${endpointId}`
          );
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        alertErrors.push(`Webhook alert failed for endpoint ${endpointId}: ${message}`);
      } finally {
        clearTimeout(timeout);
      }
    } else if (alert.type === "email") {
      console.log(
        `[EMAIL ALERT] To: ${alert.target} | ${endpoint.name} is DOWN: ${errorMessage}`
      );
    }
  }

  for (const alertError of alertErrors) {
    console.error(alertError);
  }

  return alertErrors;
}
