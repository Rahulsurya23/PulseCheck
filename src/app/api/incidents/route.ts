import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

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
    console.error("List incidents error: failed to fetch user endpoints", endpointsError);
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
      { error: "Failed to retrieve incidents" },
      { status: 500 }
    );
  }

  const endpointIds = (endpoints ?? []).map((endpoint) => endpoint.id);
  if (endpointIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: incidents, error } = await supabaseAdmin
    .from("incidents")
    .select(
      "id, endpoint_id, title, status, started_at, resolved_at, created_at, endpoint:endpoints(name, url), incident_updates(id, incident_id, status, message, created_at)"
    )
    .in("endpoint_id", endpointIds)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("List incidents error:", error);
    if (error.code === "PGRST205") {
      return NextResponse.json(
        {
          error:
            "Incident database tables are missing. Run supabase/migrations/002_create_incidents.sql in your Supabase SQL Editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to retrieve incidents" },
      { status: 500 }
    );
  }

  return NextResponse.json(incidents ?? []);
}
