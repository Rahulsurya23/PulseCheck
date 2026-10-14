import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { validateEndpointFields } from "@/lib/endpoint-input";
import { supabaseAdmin } from "@/lib/supabase";

const endpointDefaults = {
  method: "GET",
  headers: {},
  body: null,
  expected_status: 200,
  check_interval_seconds: 60,
  timeout_ms: 10000,
  retries: 2,
};

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: endpoints, error } = await supabaseAdmin
    .from("endpoints")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const enriched = await Promise.all(
    endpoints.map(async (endpoint) => {
      const [latestResult, checksResult] = await Promise.all([
        supabaseAdmin
          .from("health_checks")
          .select("status, response_time_ms, checked_at")
          .eq("endpoint_id", endpoint.id)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("health_checks")
          .select("status, response_time_ms, checked_at")
          .eq("endpoint_id", endpoint.id)
          .gte("checked_at", since),
      ]);

      if (latestResult.error) throw latestResult.error;
      if (checksResult.error) throw checksResult.error;

      const checks = checksResult.data ?? [];
      const total = checks.length;
      const upCount = checks.filter((check) => check.status === "up").length;
      const uptime = total > 0 ? (upCount / total) * 100 : 100;
      const responseTimes = checks
        .map((check) => check.response_time_ms)
        .filter((time): time is number => time !== null);
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
          : 0;

      return {
        ...endpoint,
        current_status: latestResult.data?.status ?? "unknown",
        uptime_24h: Math.round(uptime * 100) / 100,
        avg_response_time: Math.round(averageResponseTime),
        last_checked: latestResult.data?.checked_at ?? null,
      };
    })
  ).catch((err: unknown) => {
    console.error("List endpoints health checks error:", err);
    return null;
  });

  if (!enriched) {
    return NextResponse.json(
      { error: "Failed to retrieve endpoint health checks" },
      { status: 500 }
    );
  }

  return NextResponse.json(enriched);
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

  const validation = validateEndpointFields(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const { data: endpoint, error } = await supabaseAdmin
      .from("endpoints")
      .insert({
        ...endpointDefaults,
        ...validation.value,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(endpoint, { status: 201 });
  } catch (err) {
    console.error("Create endpoint error:", err);
    return NextResponse.json(
      { error: "Failed to create endpoint" },
      { status: 500 }
    );
  }
}