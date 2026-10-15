"use client";

import {
  ArrowLeft,
  Check,
  CircleAlert,
  Clock3,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Incident, IncidentUpdate } from "@/lib/types";

type IncidentWithDetails = Incident & {
  endpoint: { name: string; url: string };
  incident_updates: IncidentUpdate[];
};

const statusSequence = [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;

type IncidentStatus = (typeof statusSequence)[number];

const statusPresentation: Record<
  IncidentStatus,
  { label: string; color: string; dot: string }
> = {
  investigating: {
    label: "Investigating",
    color: "border-rose-400/15 bg-rose-400/[0.08] text-rose-300",
    dot: "bg-rose-400",
  },
  identified: {
    label: "Identified",
    color: "border-amber-400/15 bg-amber-400/[0.08] text-amber-300",
    dot: "bg-amber-400",
  },
  monitoring: {
    label: "Monitoring",
    color: "border-cyan-400/15 bg-cyan-400/[0.08] text-cyan-300",
    dot: "bg-cyan-400",
  },
  resolved: {
    label: "Resolved",
    color: "border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300",
    dot: "bg-emerald-400",
  },
};

export default function IncidentsPage() {
  const { token, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<IncidentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});

  const fetchIncidents = useCallback(async (quiet = false) => {
    if (!token) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const data = (await apiClient(token).get(
        "/api/incidents"
      )) as IncidentWithDetails[];
      setIncidents(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load incidents.";
      setError(message);
      console.error("Failed to fetch incidents:", fetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
      return;
    }
    if (!token) return;
    const timeout = window.setTimeout(() => {
      void fetchIncidents();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authLoading, user, token, router, fetchIncidents]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void fetchIncidents(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [token, fetchIncidents]);

  async function updateIncident(incident: IncidentWithDetails) {
    const nextStatus = getNextStatus(incident.status);
    const message = messages[incident.id]?.trim();
    if (!nextStatus && !message) return;

    setUpdatingId(incident.id);
    setError("");
    try {
      await apiClient(token).patch(`/api/incidents/${incident.id}`, {
        ...(nextStatus ? { status: nextStatus } : { status: incident.status }),
        ...(message ? { message } : {}),
      });
      setMessages((current) => ({ ...current, [incident.id]: "" }));
      await fetchIncidents(true);
    } catch (updateError) {
      const messageText =
        updateError instanceof Error
          ? updateError.message
          : "Could not update this incident.";
      setError(messageText);
      console.error("Failed to update incident:", updateError);
    } finally {
      setUpdatingId(null);
    }
  }

  const activeCount = incidents.filter(
    (incident) => incident.status !== "resolved"
  ).length;

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          Loading incident history
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex-1">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="mb-8">
          <button
            className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
            onClick={() => router.push("/dashboard")}
            type="button"
          >
            <ArrowLeft size={16} />
            Back to overview
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
                <Clock3 size={14} />
                Event history
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Incidents
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Investigations, updates, and resolutions for your monitors.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
                {activeCount} active
              </span>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                disabled={refreshing}
                onClick={() => void fetchIncidents(true)}
                type="button"
              >
                <RefreshCw
                  className={refreshing ? "animate-spin" : ""}
                  size={15}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            <CircleAlert className="mt-0.5 shrink-0" size={17} />
            <p className="flex-1">{error}</p>
            <button
              aria-label="Dismiss error"
              className="text-rose-200/70 hover:text-rose-100"
              onClick={() => setError("")}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {incidents.length === 0 && error ? (
          <section className="rounded-2xl border border-rose-400/15 bg-rose-400/[0.04] px-6 py-12 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/15 bg-rose-400/[0.08] text-rose-300">
              <CircleAlert size={22} />
            </span>
            <h2 className="text-base font-semibold text-white">
              Incident history is unavailable
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">
              Resolve the issue above, then refresh to load your incident history.
            </p>
            <button
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
              disabled={refreshing}
              onClick={() => void fetchIncidents(true)}
              type="button"
            >
              <RefreshCw
                className={refreshing ? "animate-spin" : ""}
                size={15}
              />
              Try again
            </button>
          </section>
        ) : incidents.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] text-emerald-300">
              <ShieldCheck size={22} />
            </span>
            <h2 className="text-base font-semibold text-white">
              No incidents recorded
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Incidents from your monitored endpoints will appear here.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            {incidents.map((incident) => {
              const status = incident.status as IncidentStatus;
              const presentation =
                statusPresentation[status] ?? statusPresentation.investigating;
              const nextStatus = getNextStatus(status);
              const updates = [...(incident.incident_updates ?? [])].sort(
                (left, right) =>
                  new Date(right.created_at).getTime() -
                  new Date(left.created_at).getTime()
              );

              return (
                <article
                  className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:p-6"
                  key={incident.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${presentation.color}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${presentation.dot}`}
                          />
                          {presentation.label}
                        </span>
                        <time className="text-xs text-slate-500">
                          Started {new Date(incident.started_at).toLocaleString()}
                        </time>
                      </div>
                      <h2 className="text-base font-semibold text-white">
                        {incident.title}
                      </h2>
                      <p className="mt-1 break-all text-sm text-slate-400">
                        {incident.endpoint?.name ?? "Endpoint"}{" "}
                        <span className="text-slate-600">·</span>{" "}
                        {incident.endpoint?.url}
                      </p>
                      {incident.resolved_at && (
                        <p className="mt-2 text-xs text-emerald-300/80">
                          Resolved {new Date(incident.resolved_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {nextStatus && (
                      <button
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-slate-300 transition hover:border-cyan-300/20 hover:bg-cyan-300/[0.06] hover:text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={updatingId === incident.id}
                        onClick={() => void updateIncident(incident)}
                        type="button"
                      >
                        {updatingId === incident.id ? (
                          <RefreshCw className="animate-spin" size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                        Mark {statusPresentation[nextStatus].label.toLowerCase()}
                      </button>
                    )}
                  </div>

                  <div className="mt-5 border-t border-white/[0.07] pt-5">
                    {updates.length > 0 ? (
                      <ol className="ml-2 space-y-4 border-l border-white/[0.1] pl-5">
                        {updates.map((update) => {
                          const updateStatus =
                            statusPresentation[
                              update.status as IncidentStatus
                            ];
                          return (
                            <li className="relative" key={update.id}>
                              <span
                                className={`absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ${
                                  updateStatus?.dot ?? "bg-slate-500"
                                } ring-4 ring-[#0b1220]`}
                              />
                              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <p className="text-sm text-slate-300">
                                  {updateStatus && (
                                    <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                      {updateStatus.label}
                                    </span>
                                  )}
                                  {update.message}
                                </p>
                                <time className="shrink-0 text-[11px] text-slate-500">
                                  {new Date(update.created_at).toLocaleString()}
                                </time>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <p className="text-xs text-slate-500">
                        No timeline updates have been recorded.
                      </p>
                    )}

                    {incident.status !== "resolved" && (
                      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                        <input
                          className="field min-w-0 flex-1"
                          maxLength={2000}
                          onChange={(event) =>
                            setMessages((current) => ({
                              ...current,
                              [incident.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && event.currentTarget.value.trim()) {
                              event.preventDefault();
                              void updateIncident(incident);
                            }
                          }}
                          placeholder="Add a timeline update…"
                          value={messages[incident.id] ?? ""}
                        />
                        <button
                          className="h-11 shrink-0 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          disabled={
                            updatingId === incident.id ||
                            !(messages[incident.id] ?? "").trim()
                          }
                          onClick={() => void updateIncident(incident)}
                          type="button"
                        >
                          Post update
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function getNextStatus(status: string): IncidentStatus | null {
  const currentIndex = statusSequence.indexOf(status as IncidentStatus);
  if (currentIndex < 0 || currentIndex === statusSequence.length - 1) {
    return null;
  }
  return statusSequence[currentIndex + 1];
}
