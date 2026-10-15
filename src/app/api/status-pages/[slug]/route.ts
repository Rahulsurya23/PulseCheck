import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type PublicStatus = "up" | "down" | "degraded" | "unknown";

type PublicCheck = {
  status: "up" | "down" | "degraded";
  response_time_ms: number | null;
  checked_at: string;
};

function migrationRequired() {
  return NextResponse.json(
    { error: "Status page data is not configured" },
    { status: 503 }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { data: page, error: pageError } = await supabaseAdmin
    .from("status_pages")
    .select("id, slug, title, description")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (pageError) {
    console.error("Get public status page error:", pageError);
    if (pageError.code === "PGRST205") return migrationRequired();
    return NextResponse.json(
      { error: "Failed to retrieve status page" },
      { status: 500 }
    );
  }
  if (!page) {
    return NextResponse.json(
      { error: "Status page not found" },
      { status: 404 }
    );
  }

  const { data: pageEndpoints, error: linksError } = await supabaseAdmin
    .from("status_page_endpoints")
    .select("endpoint_id, display_name, sort_order, endpoint:endpoints(id, name, url)")
    .eq("status_page_id", page.id)
    .order("sort_order", { ascending: true });

  if (linksError) {
    console.error("Get public status page error: failed to retrieve endpoints", linksError);
    if (linksError.code === "PGRST205") return migrationRequired();
    return NextResponse.json(
      { error: "Failed to retrieve status page endpoints" },
      { status: 500 }
    );
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const enrichedEndpoints = await Promise.all(
    (pageEndpoints ?? []).map(async (link) => {
      const endpoint = Array.isArray(link.endpoint)
        ? link.endpoint[0]
        : link.endpoint;
      if (!endpoint) {
        throw new Error(`Status page endpoint ${link.endpoint_id} is missing`);
      }

      const [checks, incidentsResult] = await Promise.all([
        getHealthChecks(link.endpoint_id, since),
        supabaseAdmin
          .from("incidents")
          .select("id, status, started_at, resolved_at")
          .eq("endpoint_id", link.endpoint_id)
          .order("started_at", { ascending: false })
          .limit(5),
      ]);

      if (incidentsResult.error) {
        throw new Error(
          `Failed to retrieve endpoint incident history: ${incidentsResult.error.message}`
        );
      }

      const latest = checks.at(-1);
      const upCount = checks.filter((check) => check.status === "up").length;
      const uptime =
        checks.length > 0 ? (upCount / checks.length) * 100 : null;
      const dailyUptime = getDailyUptime(checks);

      return {
        id: endpoint.id,
        display_name: link.display_name || endpoint.name,
        url: getPublicEndpointUrl(endpoint.url),
        current_status: latest?.status ?? "unknown",
        uptime_90d:
          uptime === null ? null : Math.round(uptime * 100) / 100,
        last_checked: latest?.checked_at ?? null,
        response_time_ms: latest?.response_time_ms ?? null,
        daily_uptime: dailyUptime,
        incidents: (incidentsResult.data ?? []).map((incident) => ({
          id: incident.id,
          title: "Service incident",
          status: incident.status,
          started_at: incident.started_at,
          resolved_at: incident.resolved_at,
        })),
      };
    })
  ).catch((error: unknown) => {
    console.error("Get public status page error: failed to enrich endpoint data", error);
    return null;
  });

  if (!enrichedEndpoints) {
    return NextResponse.json(
      { error: "Failed to retrieve status page health data" },
      { status: 500 }
    );
  }

  const statuses = enrichedEndpoints.map(
    (endpoint) => endpoint.current_status as PublicStatus
  );
  const overallStatus: PublicStatus =
    statuses.length === 0
      ? "unknown"
      : statuses.every((status) => status === "up")
        ? "up"
        : statuses.some((status) => status === "down")
          ? "down"
          : statuses.some((status) => status === "degraded")
            ? "degraded"
            : "unknown";

  return NextResponse.json({
    title: page.title,
    slug: page.slug,
    description: page.description,
    overall_status: overallStatus,
    endpoints: enrichedEndpoints,
  });
}

function getPublicEndpointUrl(endpointUrl: string) {
  const url = new URL(endpointUrl);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function getHealthChecks(endpointId: string, since: string) {
  const pageSize = 1000;
  const checks: PublicCheck[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("health_checks")
      .select("status, response_time_ms, checked_at")
      .eq("endpoint_id", endpointId)
      .gte("checked_at", since)
      .order("checked_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(
        `Failed to retrieve endpoint health history: ${error.message}`
      );
    }

    const batch = (data ?? []) as PublicCheck[];
    checks.push(...batch);
    if (batch.length < pageSize) return checks;
    offset += pageSize;
  }
}

function getDailyUptime(checks: PublicCheck[]) {
  const dailyCounts = new Map<string, { up: number; total: number }>();
  for (const check of checks) {
    const date = check.checked_at.slice(0, 10);
    const counts = dailyCounts.get(date) ?? { up: 0, total: 0 };
    counts.total += 1;
    if (check.status === "up") counts.up += 1;
    dailyCounts.set(date, counts);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: 90 }, (_, index) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - (89 - index));
    const date = day.toISOString().slice(0, 10);
    const counts = dailyCounts.get(date);

    return {
      date,
      uptime:
        counts && counts.total > 0
          ? Math.round((counts.up / counts.total) * 10000) / 100
          : null,
    };
  });
}
