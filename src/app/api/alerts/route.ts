import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

type AlertType = "email" | "webhook";

function isAlertType(value: unknown): value is AlertType {
  return value === "email" || value === "webhook";
}

function validateTarget(type: AlertType, target: unknown): string | null {
  if (typeof target !== "string" || !target.trim() || target.length > 2048) {
    return "Target must be a non-empty string of at most 2048 characters";
  }

  const value = target.trim();
  if (type === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Target must be a valid email address";
    }
    return null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Webhook target must be a valid HTTPS URL";
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return "Webhook target must be an HTTPS URL without credentials or a fragment";
  }

  return null;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: endpoints, error: endpointsError } = await supabaseAdmin
    .from("endpoints")
    .select("id")
    .eq("user_id", user.id);

  if (endpointsError) {
    console.error("List alerts error: failed to fetch user endpoints", endpointsError);
    if (endpointsError.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "Monitoring tables are missing. Run supabase/migrations/002_create_monitoring_tables.sql in your Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to retrieve alerts" },
      { status: 500 }
    );
  }

  const endpointIds = (endpoints ?? []).map((endpoint) => endpoint.id);
  if (endpointIds.length === 0) return NextResponse.json([]);

  const { data: alerts, error } = await supabaseAdmin
    .from("alert_configs")
    .select("id, endpoint_id, type, target, is_active, created_at, endpoint:endpoints(name)")
    .in("endpoint_id", endpointIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("List alerts error:", error);
    if (error.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "Alert database table is missing. Run supabase/migrations/002_create_monitoring_tables.sql in your Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to retrieve alerts" },
      { status: 500 }
    );
  }

  return NextResponse.json(alerts ?? []);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  if (
    Object.keys(input).some(
      (key) => !["endpoint_id", "type", "target"].includes(key)
    )
  ) {
    return NextResponse.json(
      { error: "Only endpoint_id, type, and target are supported" },
      { status: 400 }
    );
  }

  const { endpoint_id: endpointId, type, target } = input;
  if (typeof endpointId !== "string" || !endpointId.trim()) {
    return NextResponse.json(
      { error: "Endpoint ID is required" },
      { status: 400 }
    );
  }
  if (!isAlertType(type)) {
    return NextResponse.json(
      { error: "Type must be email or webhook" },
      { status: 400 }
    );
  }

  const targetError = validateTarget(type, target);
  if (targetError) {
    return NextResponse.json({ error: targetError }, { status: 400 });
  }

  const { data: endpoint, error: endpointError } = await supabaseAdmin
    .from("endpoints")
    .select("id")
    .eq("id", endpointId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (endpointError) {
    console.error("Create alert error: failed to verify endpoint ownership", endpointError);
    return NextResponse.json(
      { error: "Failed to verify endpoint" },
      { status: 500 }
    );
  }
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
  }

  const { data: alert, error } = await supabaseAdmin
    .from("alert_configs")
    .insert({
      endpoint_id: endpointId,
      type,
      target: (target as string).trim(),
      is_active: true,
    })
    .select("id, endpoint_id, type, target, is_active, created_at")
    .single();

  if (error) {
    console.error("Create alert error:", error);
    if (error.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "Alert database table is missing. Run supabase/migrations/002_create_monitoring_tables.sql in your Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
  }

  return NextResponse.json(alert, { status: 201 });
}
