"use client";

import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Clock3,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type DailyUptime = {
  date: string;
  uptime: number | null;
};

type PublicIncident = {
  id: string;
  title: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
};

type PublicEndpoint = {
  id: string;
  display_name: string;
  url: string;
  current_status: "up" | "down" | "degraded" | "unknown";
  uptime_90d: number | null;
  last_checked: string | null;
  response_time_ms: number | null;
  daily_uptime: DailyUptime[];
  incidents: PublicIncident[];
};

type PublicStatusPage = {
  title: string;
  slug: string;
  description: string | null;
  overall_status: PublicEndpoint["current_status"];
  endpoints: PublicEndpoint[];
};

export default function PublicStatusRoute() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            Loading service status
          </div>
        </main>
      }
    >
      <PublicStatusPage />
    </Suspense>
  );
}

function PublicStatusPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PublicStatusPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async (quiet = false) => {
    if (!slug) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/status-pages/${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not load this status page.");
      }
      setData(result as PublicStatusPage);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load this status page.";
      setError(message);
      console.error("Failed to fetch public status page:", fetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchStatus();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [fetchStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchStatus(true);
    }, 60000);
    return () => window.clearInterval(interval);
  }, [fetchStatus]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          Loading service status
        </div>
      </main>
    );
  }

  if (!data) {
    const missing = error.toLowerCase().includes("not found");
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center px-5">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-400/[0.08] text-rose-300">
            {missing ? <XCircle size={22} /> : <CircleAlert size={22} />}
          </span>
          <h1 className="text-xl font-semibold text-white">
            {missing ? "Status page not found" : "Status page unavailable"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {error || "This status page does not exist or is not public."}
          </p>
          {!missing && (
            <button
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
              onClick={() => void fetchStatus()}
              type="button"
            >
              <RefreshCw size={15} />
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  const overall = overallPresentation(data.overall_status);

  return (
    <main className="min-h-screen flex-1">
      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-16">
        <header className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
            <Activity size={14} />
            Service status
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {data.title}
          </h1>
          {data.description && (
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">
              {data.description}
            </p>
          )}
        </header>

        <div
          className={`mb-7 flex items-center gap-3 rounded-2xl border px-5 py-4 ${overall.container}`}
          role="status"
        >
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${overall.iconContainer}`}>
            {overall.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold ${overall.text}`}>
              {overall.label}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {data.endpoints.length} monitored service
              {data.endpoints.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            aria-label="Refresh status"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            disabled={refreshing}
            onClick={() => void fetchStatus(true)}
            type="button"
          >
            <RefreshCw
              className={refreshing ? "animate-spin" : ""}
              size={15}
            />
          </button>
        </div>

        <section aria-label="Monitored services" className="space-y-4">
          {data.endpoints.map((endpoint) => {
            const presentation = endpointPresentation(endpoint.current_status);
            return (
              <article
                className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/80 p-5 sm:p-6"
                key={endpoint.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${presentation.dot}`} />
                      <h2 className="truncate font-semibold text-white">
                        {endpoint.display_name}
                      </h2>
                    </div>
                    <p className="mt-1 truncate pl-4 text-xs text-slate-500">
                      {endpoint.url}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${presentation.badge}`}>
                    {presentation.label}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 text-xs">
                  <p className="text-slate-400">
                    90-day uptime{" "}
                    <span className="ml-1 font-mono font-medium text-white">
                      {endpoint.uptime_90d === null
                        ? "No data"
                        : `${endpoint.uptime_90d.toFixed(2)}%`}
                    </span>
                  </p>
                  {endpoint.response_time_ms !== null && (
                    <p className="text-slate-400">
                      Response time{" "}
                      <span className="ml-1 font-mono font-medium text-white">
                        {endpoint.response_time_ms} ms
                      </span>
                    </p>
                  )}
                  {endpoint.last_checked && (
                    <p className="text-slate-500">
                      Updated {new Date(endpoint.last_checked).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <div
                    aria-label={`90-day uptime history for ${endpoint.display_name}`}
                    className="flex h-8 items-stretch gap-[3px]"
                    role="img"
                  >
                    {endpoint.daily_uptime.map((day) => {
                      const color =
                        day.uptime === null
                          ? "bg-slate-700/60"
                          : day.uptime >= 99.99
                            ? "bg-emerald-400"
                            : day.uptime >= 95
                              ? "bg-amber-400"
                              : "bg-rose-400";
                      return (
                        <span
                          className={`min-w-0 flex-1 rounded-sm ${color}`}
                          key={day.date}
                          title={`${day.date}: ${
                            day.uptime === null
                              ? "No data"
                              : `${day.uptime.toFixed(2)}% uptime`
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-600">
                    <span>90 days ago</span>
                    <span>Today</span>
                  </div>
                </div>

                {endpoint.incidents.length > 0 && (
                  <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <h3 className="mb-3 text-xs font-medium text-slate-400">
                      Recent incidents
                    </h3>
                    <ul className="space-y-2">
                      {endpoint.incidents.slice(0, 3).map((incident) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                          key={incident.id}
                        >
                          <span className="flex items-center gap-2 text-slate-300">
                            {incident.status === "resolved" ? (
                              <CheckCircle2
                                className="text-emerald-400"
                                size={14}
                              />
                            ) : (
                              <CircleAlert className="text-amber-400" size={14} />
                            )}
                            {incident.title}
                          </span>
                          <time className="text-slate-500">
                            {new Date(incident.started_at).toLocaleDateString()}
                            {incident.resolved_at
                              ? ` · Resolved ${new Date(incident.resolved_at).toLocaleDateString()}`
                              : " · Ongoing"}
                          </time>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <footer className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-600">
          <Clock3 size={13} />
          Status updates refresh automatically every minute
          <span className="mx-1">·</span>
          Powered by{" "}
          <Link className="text-slate-400 transition hover:text-cyan-300" href="/">
            PulseCheck
          </Link>
          <ShieldCheck className="ml-1" size={13} />
        </footer>
      </div>
    </main>
  );
}

function overallPresentation(status: PublicEndpoint["current_status"]) {
  if (status === "up") {
    return {
      label: "All systems operational",
      container: "border-emerald-400/15 bg-emerald-400/[0.05]",
      iconContainer: "bg-emerald-400/[0.1] text-emerald-300",
      text: "text-emerald-200",
      icon: <CheckCircle2 size={20} />,
    };
  }
  if (status === "down") {
    return {
      label: "Some systems are experiencing issues",
      container: "border-rose-400/15 bg-rose-400/[0.05]",
      iconContainer: "bg-rose-400/[0.1] text-rose-300",
      text: "text-rose-200",
      icon: <CircleAlert size={20} />,
    };
  }
  if (status === "degraded") {
    return {
      label: "Some systems are degraded",
      container: "border-amber-400/15 bg-amber-400/[0.05]",
      iconContainer: "bg-amber-400/[0.1] text-amber-300",
      text: "text-amber-200",
      icon: <CircleAlert size={20} />,
    };
  }
  return {
    label: "Status data is not available yet",
    container: "border-slate-400/15 bg-slate-400/[0.04]",
    iconContainer: "bg-slate-400/[0.08] text-slate-300",
    text: "text-slate-200",
    icon: <Activity size={20} />,
  };
}

function endpointPresentation(status: PublicEndpoint["current_status"]) {
  if (status === "up") {
    return {
      label: "Operational",
      dot: "bg-emerald-400",
      badge: "border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300",
    };
  }
  if (status === "down") {
    return {
      label: "Service disruption",
      dot: "bg-rose-400",
      badge: "border-rose-400/15 bg-rose-400/[0.06] text-rose-300",
    };
  }
  if (status === "degraded") {
    return {
      label: "Degraded performance",
      dot: "bg-amber-400",
      badge: "border-amber-400/15 bg-amber-400/[0.06] text-amber-300",
    };
  }
  return {
    label: "Awaiting data",
    dot: "bg-slate-400",
    badge: "border-slate-400/15 bg-slate-400/[0.06] text-slate-300",
  };
}
