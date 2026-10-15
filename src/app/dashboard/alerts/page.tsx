"use client";

import {
  ArrowLeft,
  Bell,
  Check,
  CircleAlert,
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Webhook,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { AlertConfig, EndpointWithStatus } from "@/lib/types";

type AlertWithEndpoint = AlertConfig & {
  endpoint: { name: string };
};

type AlertType = "webhook" | "email";

export default function AlertsPage() {
  const { token, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertWithEndpoint[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [alertType, setAlertType] = useState<AlertType>("webhook");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!token) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const api = apiClient(token);
      const [alertData, endpointData] = await Promise.all([
        api.get("/api/alerts") as Promise<AlertWithEndpoint[]>,
        api.get("/api/endpoints") as Promise<EndpointWithStatus[]>,
      ]);
      setAlerts(alertData);
      setEndpoints(endpointData);
      setSelectedEndpoint((current) =>
        current || endpointData[0]?.id || ""
      );
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load alert configurations.";
      setError(message);
      console.error("Failed to fetch alerts:", fetchError);
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
      void fetchData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [authLoading, user, token, router, fetchData]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void fetchData(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [token, fetchData]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await apiClient(token).post("/api/alerts", {
        endpoint_id: selectedEndpoint,
        type: alertType,
        target: target.trim(),
      });
      setTarget("");
      setShowAdd(false);
      await fetchData(true);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Could not create alert.";
      setError(message);
      console.error("Failed to create alert:", submitError);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAlert(alert: AlertWithEndpoint) {
    setUpdatingId(alert.id);
    setError("");
    try {
      await apiClient(token).patch(`/api/alerts/${alert.id}`, {
        is_active: !alert.is_active,
      });
      await fetchData(true);
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Could not update alert.";
      setError(message);
      console.error("Failed to update alert:", updateError);
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteAlert(alert: AlertWithEndpoint) {
    if (!window.confirm(`Delete this alert for ${alert.endpoint?.name ?? "this endpoint"}?`)) {
      return;
    }

    setUpdatingId(alert.id);
    setError("");
    try {
      await apiClient(token).delete(`/api/alerts/${alert.id}`);
      setAlerts((current) => current.filter((item) => item.id !== alert.id));
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete alert.";
      setError(message);
      console.error("Failed to delete alert:", deleteError);
    } finally {
      setUpdatingId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          Loading alert configurations
        </div>
      </main>
    );
  }

  const activeCount = alerts.filter((alert) => alert.is_active).length;

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
                <Bell size={14} />
                Notifications
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Alerts
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Choose where to notify you when a monitor goes down.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
                {activeCount} active
              </span>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                disabled={refreshing}
                onClick={() => void fetchData(true)}
                type="button"
              >
                <RefreshCw
                  className={refreshing ? "animate-spin" : ""}
                  size={15}
                />
                Refresh
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:opacity-50"
                disabled={endpoints.length === 0}
                onClick={() => setShowAdd((current) => !current)}
                type="button"
              >
                <Plus size={16} />
                Add alert
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

        {showAdd && (
          <form
            className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:p-6"
            onSubmit={handleAdd}
          >
            <div className="mb-5">
              <h2 className="font-semibold text-white">New alert</h2>
              <p className="mt-1 text-xs text-slate-500">
                Alert targets are used by the health-check service when a monitor is down.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-slate-300"
                  htmlFor="alert-endpoint"
                >
                  Endpoint
                </label>
                <select
                  className="field"
                  id="alert-endpoint"
                  onChange={(event) => setSelectedEndpoint(event.target.value)}
                  required
                  value={selectedEndpoint}
                >
                  <option value="">Select a monitor</option>
                  {endpoints.map((endpoint) => (
                    <option key={endpoint.id} value={endpoint.id}>
                      {endpoint.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="mb-2 block text-sm font-medium text-slate-300"
                  htmlFor="alert-type"
                >
                  Alert type
                </label>
                <select
                  className="field"
                  id="alert-type"
                  onChange={(event) =>
                    setAlertType(event.target.value as AlertType)
                  }
                  value={alertType}
                >
                  <option value="webhook">Webhook</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label
                  className="mb-2 block text-sm font-medium text-slate-300"
                  htmlFor="alert-target"
                >
                  {alertType === "webhook" ? "Webhook HTTPS URL" : "Email address"}
                </label>
                <input
                  autoComplete="off"
                  className="field"
                  id="alert-target"
                  maxLength={2048}
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder={
                    alertType === "webhook"
                      ? "https://hooks.example.com/services/..."
                      : "alerts@company.com"
                  }
                  required
                  type={alertType === "webhook" ? "url" : "email"}
                  value={target}
                />
                {alertType === "email" && (
                  <p className="mt-2 text-xs leading-5 text-amber-200/80">
                    Email delivery is a placeholder for now; configured email alerts are logged by the server and are not sent yet.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-10 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                disabled={saving}
                onClick={() => {
                  setShowAdd(false);
                  setError("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving}
                type="submit"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={15} />
                ) : (
                  <Plus size={16} />
                )}
                {saving ? "Creating…" : "Create alert"}
              </button>
            </div>
          </form>
        )}

        {alerts.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-300">
              <Bell size={22} />
            </span>
            <h2 className="text-base font-semibold text-white">
              {endpoints.length === 0
                ? "Add a monitor to configure alerts"
                : "No alerts configured"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              {endpoints.length === 0
                ? "Create an endpoint monitor first, then you can attach email or webhook notifications to it."
                : "Add a webhook or email target to be notified when one of your monitors goes down."}
            </p>
            {endpoints.length > 0 && (
              <button
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                onClick={() => setShowAdd(true)}
                type="button"
              >
                <Plus size={16} />
                Add your first alert
              </button>
            )}
          </section>
        ) : (
          <section aria-label="Configured alerts" className="space-y-3">
            {alerts.map((alert) => {
              const busy = updatingId === alert.id;
              return (
                <article
                  className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:flex-row sm:items-center sm:justify-between"
                  key={alert.id}
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-cyan-300">
                      {alert.type === "webhook" ? (
                        <Webhook size={18} />
                      ) : (
                        <Mail size={18} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h2 className="font-medium text-white">
                          {alert.endpoint?.name ?? "Unknown endpoint"}
                        </h2>
                        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {alert.type}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            alert.is_active
                              ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
                              : "border-white/[0.08] bg-white/[0.03] text-slate-400"
                          }`}
                        >
                          {alert.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-slate-500">
                        {alert.type === "webhook"
                          ? describeWebhook(alert.target)
                          : alert.target}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-14 sm:pl-0">
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void toggleAlert(alert)}
                      type="button"
                    >
                      {busy ? (
                        <RefreshCw className="animate-spin" size={13} />
                      ) : (
                        <Check size={13} />
                      )}
                      {alert.is_active ? "Pause" : "Activate"}
                    </button>
                    <button
                      aria-label={`Delete alert for ${alert.endpoint?.name ?? "endpoint"}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-slate-400 transition hover:border-rose-400/20 hover:bg-rose-400/[0.06] hover:text-rose-300 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void deleteAlert(alert)}
                      type="button"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

function describeWebhook(target: string) {
  try {
    const url = new URL(target);
    return `${url.hostname} · destination hidden`;
  } catch {
    return "Configured webhook destination";
  }
}
