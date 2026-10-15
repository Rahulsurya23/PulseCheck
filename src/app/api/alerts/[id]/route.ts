import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

async function getOwnedAlert(id: string, userId: string) {
  const { data: endpoints, error: endpointsError } = await supabaseAdmin
    .from("endpoints")
    .select("id")
    .eq("user_id", userId);

  if (endpointsError) {
    return { alert: null, error: endpointsError, unavailable: false };
  }

  const endpointIds = (endpoints ?? []).map((endpoint) => endpoint.id);
  if (endpointIds.length === 0) {
    return { alert: null, error: null, unavailable: false };
  }

  const { data: alert, error } = await supabaseAdmin
    .from("alert_configs")
    .select("id, endpoint_id, type, target, is_active, created_at")
    .eq("id", id)
    .in("endpoint_id", endpointIds)
    .maybeSingle();

  return {
    alert,
    error,
    unavailable: error?.code === "PGRST205",
  };
}

function missingTableResponse() {
  return NextResponse.json(
    {
      error:
        "Alert database table is missing. Run supabase/migrations/002_create_monitoring_tables.sql in your Supabase SQL Editor.",
    },
    { status: 503 }
  );
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
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

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    typeof (body as Record<string, unknown>).is_active !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Request body must contain an is_active boolean" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const result = await getOwnedAlert(id, user.id);
  if (result.unavailable) return missingTableResponse();
  if (result.error) {
    console.error("Update alert error: failed to look up alert", result.error);
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }
  if (!result.alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const { data: alert, error } = await supabaseAdmin
    .from("alert_configs")
    .update({ is_active: (body as { is_active: boolean }).is_active })
    .eq("id", id)
    .eq("endpoint_id", result.alert.endpoint_id)
    .select("id, endpoint_id, type, target, is_active, created_at")
    .single();

  if (error) {
    console.error("Update alert error:", error);
    if (error.code === "PGRST205") return missingTableResponse();
    return NextResponse.json({ error: "Failed to update alert" }, { status: 500 });
  }

  return NextResponse.json(alert);
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getAuthUser(_req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await getOwnedAlert(id, user.id);
  if (result.unavailable) return missingTableResponse();
  if (result.error) {
    console.error("Delete alert error: failed to look up alert", result.error);
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }
  if (!result.alert) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("alert_configs")
    .delete()
    .eq("id", id)
    .eq("endpoint_id", result.alert.endpoint_id);

  if (error) {
    console.error("Delete alert error:", error);
    if (error.code === "PGRST205") return missingTableResponse();
    return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
