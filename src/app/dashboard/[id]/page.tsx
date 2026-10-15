"use client";

import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Suspense } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Endpoint, HealthCheck } from "@/lib/types";

const timeRanges = [1, 6, 24, 48, 168];

export default function EndpointDetail() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            Loading endpoint details
          </div>
        </main>
      }
    >
      <EndpointDetailContent />
    </Suspense>
  );
}

function EndpointDetailContent() {
  const { token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (quiet = false) => {
    if (!token || !id) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const api = apiClient(token);
      const [endpointData, checkData] = await Promise.all([
        api.get(`/api/endpoints/${encodeURIComponent(id)}`) as Promise<Endpoint>,
        api.get(
          `/api/endpoints/${encodeURIComponent(id)}/checks?hours=${hours}`
        ) as Promise<HealthCheck[]>,
      ]);
      setEndpoint(endpointData);
      setChecks(checkData);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load endpoint details.";
      setError(message);
      console.error("Failed to fetch endpoint data:", fetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, id, hours]);

  useEffect(() => {
    if (!authLoading && !token) {
      router.replace("/");
      return;
    }
    if (!token) return;
    const timeout = window.setTimeout(() => {
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authLoading, token, router, fetchData]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void fetchData(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [token, fetchData]);

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          Loading endpoint details
        </div>
      </main>
    );
  }

  if (!endpoint) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-5">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-400/[0.08] text-rose-300">
            <CircleAlert size={22} />
          </span>
          <h1 className="text-lg font-semibold text-white">
            Couldn&apos;t load this monitor
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {error || "The endpoint may have been removed or is unavailable."}
          </p>
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            <ArrowLeft size={16} />
            Back to overview
          </button>
        </div>
      </main>
    );
  }

  const latestCheck = checks.at(-1);
  const upCount = checks.filter((check) => check.status === "up").length;
  const uptime =
    checks.length > 0
      ? Math.round((upCount / checks.length) * 10000) / 100
      : 100;
  const chartData = checks.map((check) => ({
    time: new Date(check.checked_at).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    responseTime: check.response_time_ms,
  }));
  const status = latestCheck?.status ?? "unknown";
  const statusStyle = {
    up: "border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300",
    down: "border-rose-400/15 bg-rose-400/[0.08] text-rose-300",
    degraded: "border-amber-400/15 bg-amber-400/[0.08] text-amber-300",
    unknown: "border-slate-400/15 bg-slate-400/[0.08] text-slate-300",
  }[status];

  return (
    <main className="min-h-screen flex-1">
      <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
        <button
          className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          onClick={() => router.push("/dashboard")}
          type="button"
        >
          <ArrowLeft size={16} />
          Back to overview
        </button>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              <Activity size={14} />
              Monitor details
            </div>
            <h1 className="truncate text-3xl font-semibold tracking-tight text-white">
              {endpoint.name}
            </h1>
            <p className="mt-2 break-all font-mono text-sm text-slate-400">
              <span className="mr-2 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
                {endpoint.method}
              </span>
              {endpoint.url}
            </p>
          </div>
          <button
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50 sm:self-auto"
            disabled={refreshing}
            onClick={() => void fetchData(true)}
            type="button"
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} size={15} />
            Refresh
          </button>
        </div>

        {error && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            <CircleAlert className="mt-0.5 shrink-0" size={17} />
            <p>{error}</p>
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Current status</p>
              <span
                className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ${statusStyle}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {status === "unknown" ? "Awaiting check" : status}
              </span>
            </div>
            {latestCheck && (
              <p className="text-xs text-slate-500">
                Last checked {new Date(latestCheck.checked_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-5 border-t border-white/[0.07] pt-5 sm:grid-cols-4">
            <DetailMetric
              icon={<Activity size={15} />}
              label={`Uptime · ${formatRange(hours)}`}
              value={`${uptime.toFixed(2)}%`}
            />
            <DetailMetric
              icon={<Clock3 size={15} />}
              label="Check interval"
              value={formatDuration(endpoint.check_interval_seconds)}
            />
            <DetailMetric
              icon={<Clock3 size={15} />}
              label="Timeout"
              value={`${endpoint.timeout_ms.toLocaleString()} ms`}
            />
            <DetailMetric
              icon={<Activity size={15} />}
              label="Checks in range"
              value={checks.length.toLocaleString()}
            />
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Response time</h2>
              <p className="mt-1 text-xs text-slate-500">
                Measurements recorded during the selected period.
              </p>
            </div>
            <div
              aria-label="Chart time range"
              className="flex gap-1 rounded-xl border border-white/[0.08] bg-[#0b1220]/75 p-1"
              role="group"
            >
              {timeRanges.map((range) => (
                <button
                  aria-pressed={hours === range}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    hours === range
                      ? "bg-cyan-300 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                  key={range}
                  onClick={() => setHours(range)}
                  type="button"
                >
                  {formatRange(range)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-4 sm:p-6">
            {chartData.length > 0 ? (
              <ResponsiveContainer height={300} minWidth={0} width="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                >
                  <CartesianGrid
                    stroke="rgba(148,163,184,0.12)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    axisLine={false}
                    dataKey="time"
                    minTickGap={30}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    tickLine={false}
                    unit=" ms"
                    width={56}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111b2b",
                      border: "1px solid rgba(148,163,184,0.18)",
                      borderRadius: "12px",
                      color: "#e2e8f0",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [
                      value === null || value === undefined
                        ? "No response"
                        : `${value} ms`,
                      "Response time",
                    ]}
                  />
                  <Line
                    activeDot={{ r: 4, fill: "#67e8f9", stroke: "#0b1220", strokeWidth: 2 }}
                    connectNulls={false}
                    dataKey="responseTime"
                    dot={false}
                    stroke="#67e8f9"
                    strokeWidth={2}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] flex-col items-center justify-center text-center">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-500">
                  <Activity size={18} />
                </span>
                <p className="text-sm font-medium text-slate-300">
                  No check data in this range
                </p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                  Health checks will appear here after the cron job has checked
                  this endpoint.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-white">Recent checks</h2>
            <p className="mt-1 text-xs text-slate-500">
              The latest 20 checks from the selected time range.
            </p>
          </div>
          {checks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs text-slate-500">
                    <th className="pb-3 pr-4 font-medium">Time</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 pr-4 font-medium">Code</th>
                    <th className="pb-3 pr-4 font-medium">Response time</th>
                    <th className="pb-3 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {[...checks].reverse().slice(0, 20).map((check) => (
                    <tr
                      className="border-b border-white/[0.05] last:border-0"
                      key={check.id}
                    >
                      <td className="whitespace-nowrap py-3 pr-4 text-xs text-slate-400">
                        {new Date(check.checked_at).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <CheckStatus status={check.status} />
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs text-slate-300">
                        {check.status_code ?? "—"}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-slate-300">
                        {check.response_time_ms === null
                          ? "—"
                          : `${check.response_time_ms} ms`}
                      </td>
                      <td
                        className="max-w-[240px] truncate py-3 text-xs text-slate-500"
                        title={check.error_message ?? undefined}
                      >
                        {check.error_message || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center text-sm text-slate-500">
              No checks to display yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function DetailMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-2 font-mono text-base font-medium text-white">{value}</p>
    </div>
  );
}

function CheckStatus({ status }: { status: HealthCheck["status"] }) {
  const style = {
    up: "bg-emerald-400/[0.08] text-emerald-300",
    down: "bg-rose-400/[0.08] text-rose-300",
    degraded: "bg-amber-400/[0.08] text-amber-300",
  }[status];

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${style}`}>
      {status}
    </span>
  );
}

function formatRange(hours: number) {
  return hours < 24 ? `${hours}h` : `${hours / 24}d`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  if (seconds % 3600 === 0) return `${seconds / 3600} hr`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} sec`;
}
