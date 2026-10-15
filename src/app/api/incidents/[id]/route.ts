import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const incidentStatuses = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

type IncidentStatus = (typeof incidentStatuses)[number];
type RouteContext = { params: Promise<{ id: string }> };

const nextStatuses: Record<IncidentStatus, IncidentStatus[]> = {
  investigating: ["identified", "monitoring", "resolved"],
  identified: ["monitoring", "resolved"],
  monitoring: ["resolved"],
  resolved: [],
};

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

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be a JSON object" },
      { status: 400 }
    );
  }

  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["status", "message"].includes(key))) {
    return NextResponse.json(
      { error: "Only status and message can be updated" },
      { status: 400 }
    );
  }

  const status = input.status;
  const message = input.message;
  if (
    typeof status !== "string" ||
    !incidentStatuses.includes(status as IncidentStatus)
  ) {
    return NextResponse.json(
      {
        error: `Status must be one of: ${incidentStatuses.join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (
    message !== undefined &&
    (typeof message !== "string" || message.trim().length === 0 || message.length > 2000)
  ) {
    return NextResponse.json(
      { error: "Message must be a non-empty string of at most 2000 characters" },
      { status: 400 }
    );
  }

  const { id } = await params;
  const { data: endpoints, error: endpointsError } = await supabaseAdmin
    .from("endpoints")
    .select("id")
    .eq("user_id", user.id);

  if (endpointsError) {
    console.error("Update incident error: failed to fetch user endpoints", endpointsError);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }

  const endpointIds = (endpoints ?? []).map((endpoint) => endpoint.id);
  if (endpointIds.length === 0) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const { data: existingIncident, error: lookupError } = await supabaseAdmin
    .from("incidents")
    .select("id, endpoint_id, status")
    .eq("id", id)
    .in("endpoint_id", endpointIds)
    .maybeSingle();

  if (lookupError) {
    console.error("Update incident error: failed to load incident", lookupError);
    if (lookupError.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "Incident database tables are missing. Run supabase/migrations/002_create_incidents.sql in your Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
  if (!existingIncident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }

  const currentStatus = existingIncident.status as IncidentStatus;
  if (
    status !== currentStatus &&
    !nextStatuses[currentStatus]?.includes(status as IncidentStatus)
  ) {
    return NextResponse.json(
      { error: `An incident cannot move from ${currentStatus} to ${status}` },
      { status: 409 }
    );
  }

  const updateMessage =
    typeof message === "string"
      ? message.trim()
      : status === currentStatus
        ? null
        : `Status changed to ${status}.`;

  if (status === currentStatus && !updateMessage) {
    return NextResponse.json(
      { error: "Provide a message when the status is unchanged" },
      { status: 400 }
    );
  }

  const updateData: { status: IncidentStatus; resolved_at?: string } = {
    status: status as IncidentStatus,
  };
  if (status === "resolved" && currentStatus !== "resolved") {
    updateData.resolved_at = new Date().toISOString();
  }

  if (status !== currentStatus) {
    const { error: updateError } = await supabaseAdmin
      .from("incidents")
      .update(updateData)
      .eq("id", id)
      .eq("endpoint_id", existingIncident.endpoint_id);

    if (updateError) {
      console.error("Update incident error: failed to update status", updateError);
      return NextResponse.json(
        { error: "Failed to update incident status" },
        { status: 500 }
      );
    }
  }

  const { error: timelineError } = await supabaseAdmin
    .from("incident_updates")
    .insert({
      incident_id: id,
      status,
      message: updateMessage,
    });

  if (timelineError) {
    console.error("Update incident error: failed to record timeline update", timelineError);
    return NextResponse.json(
      { error: "Incident status was updated, but its timeline entry could not be recorded" },
      { status: 500 }
    );
  }

  const { data: incident, error: responseError } = await supabaseAdmin
    .from("incidents")
    .select(
      "id, endpoint_id, title, status, started_at, resolved_at, created_at, endpoint:endpoints(name, url), incident_updates(id, incident_id, status, message, created_at)"
    )
    .eq("id", id)
    .eq("endpoint_id", existingIncident.endpoint_id)
    .single();

  if (responseError) {
    console.error("Update incident error: failed to retrieve updated incident", responseError);
    return NextResponse.json(
      { error: "Incident updated but failed to retrieve its details" },
      { status: 500 }
    );
  }

  return NextResponse.json(incident);
}
