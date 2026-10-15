"use client";

import {
  Activity,
  ArrowUpRight,
  Check,
  CircleAlert,
  Clock3,
  LogOut,
  Plus,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { EndpointWithStatus } from "@/lib/types";

export default function Dashboard() {
  const { user, token, logout, isLoading } = useAuth();
  const router = useRouter();
  const [endpoints, setEndpoints] = useState<EndpointWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchEndpoints = useCallback(async (quiet = false) => {
    if (!token) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const data = (await apiClient(token).get(
        "/api/endpoints"
      )) as EndpointWithStatus[];
      setEndpoints(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load your endpoints.";
      setError(message);
      console.error("Failed to fetch endpoints:", fetchError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
      return;
    }
    if (!token) return;
    const timeout = window.setTimeout(() => {
      void fetchEndpoints();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [user, token, isLoading, router, fetchEndpoints]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => {
      void fetchEndpoints(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [token, fetchEndpoints]);

  const upCount = endpoints.filter(
    (endpoint) =>
      endpoint.current_status === "up" ||
      endpoint.current_status === "degraded"
  ).length;
  const downCount = endpoints.filter(
    (endpoint) => endpoint.current_status === "down"
  ).length;

  if (isLoading || loading) {
    return <PageLoader label="Loading your monitors" />;
  }

  return (
    <main className="min-h-screen flex-1">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
              <Activity size={14} />
              PulseCheck
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Overview
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Welcome back, {user?.name || user?.email || "there"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-slate-300 transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              disabled={refreshing}
              onClick={() => void fetchEndpoints(true)}
              type="button"
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} size={16} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 text-sm font-medium text-slate-300 transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-white"
              onClick={() => {
                logout();
                router.replace("/");
              }}
              type="button"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              onClick={() => setShowAddModal(true)}
              type="button"
            >
              <Plus size={17} />
              Add endpoint
            </button>
          </div>
        </header>

        {error && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            <CircleAlert className="mt-0.5 shrink-0" size={17} />
            <div className="flex-1">{error}</div>
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

        <section aria-label="Monitor summary" className="mb-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<Server size={18} />}
            label="Total monitors"
            value={endpoints.length}
            detail="Configured endpoints"
            iconTone="text-slate-300"
          />
          <SummaryCard
            icon={<Check size={18} />}
            label="Operational"
            value={upCount}
            detail="Up or responding slowly"
            iconTone="text-emerald-300"
          />
          <SummaryCard
            icon={<CircleAlert size={18} />}
            label="Needs attention"
            value={downCount}
            detail="Currently reporting down"
            iconTone="text-rose-300"
          />
        </section>

        <section aria-labelledby="monitors-heading">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-semibold text-white"
                id="monitors-heading"
              >
                Monitors
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Live service status and the last 24 hours.
              </p>
            </div>
            <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Refreshes every 30 seconds
            </span>
          </div>

          {endpoints.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-300">
                <Activity size={22} />
              </span>
              <h3 className="text-base font-semibold text-white">
                Your first monitor starts here
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
                Add an API endpoint and PulseCheck will keep its health history
                and uptime in one place.
              </p>
              <button
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                onClick={() => setShowAddModal(true)}
                type="button"
              >
                <Plus size={16} />
                Add your first endpoint
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {endpoints.map((endpoint) => (
                <EndpointCard endpoint={endpoint} key={endpoint.id} />
              ))}
            </div>
          )}
        </section>
      </div>

      {showAddModal && (
        <AddEndpointModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false);
            void fetchEndpoints(true);
          }}
          token={token}
        />
      )}
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  iconTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  detail: string;
  iconTone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.04] ${iconTone}`}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: EndpointWithStatus }) {
  const status = endpoint.current_status;
  const statusStyles = {
    up: "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300",
    down: "border-rose-400/15 bg-rose-400/[0.07] text-rose-300",
    degraded: "border-amber-400/15 bg-amber-400/[0.07] text-amber-300",
    unknown: "border-slate-400/15 bg-slate-400/[0.07] text-slate-300",
  }[status];
  const statusLabel = {
    up: "Operational",
    down: "Down",
    degraded: "Degraded",
    unknown: "Awaiting check",
  }[status];
  const statusDot = {
    up: "bg-emerald-400",
    down: "bg-rose-400",
    degraded: "bg-amber-400",
    unknown: "bg-slate-400",
  }[status];

  return (
    <Link
      className="group grid gap-4 rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 transition hover:border-cyan-300/20 hover:bg-[#0e1727] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      href={`/dashboard/${endpoint.id}`}
    >
      <div className="flex min-w-0 items-start gap-4">
        <span className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300">
          <Activity size={18} />
        </span>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-white">{endpoint.name}</h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusStyles}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
          </div>
          <p className="truncate text-sm text-slate-500">
            <span className="mr-2 font-mono text-[11px] text-slate-400">
              {endpoint.method}
            </span>
            {endpoint.url}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 pl-14 sm:justify-end sm:pl-0">
        <Metric
          label="Uptime · 24h"
          value={`${endpoint.uptime_24h.toFixed(2)}%`}
          tone={
            endpoint.uptime_24h >= 99
              ? "text-emerald-300"
              : endpoint.uptime_24h >= 95
                ? "text-amber-300"
                : "text-rose-300"
          }
        />
        <Metric
          label="Avg. response"
          value={
            endpoint.avg_response_time > 0
              ? `${endpoint.avg_response_time} ms`
              : "—"
          }
          icon={<Clock3 size={13} />}
        />
        <ArrowUpRight
          className="hidden text-slate-600 transition group-hover:text-cyan-300 sm:block"
          size={17}
        />
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  tone = "text-white",
  icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`mt-1 flex items-center gap-1 font-mono text-sm font-medium ${tone}`}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function AddEndpointModal({
  token,
  onClose,
  onCreated,
}: {
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState("GET");
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [interval, setInterval] = useState(60);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      await apiClient(token).post("/api/endpoints", {
        name,
        url,
        method,
        expected_status: expectedStatus,
        check_interval_seconds: interval,
      });
      onCreated();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create the endpoint."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="add-endpoint-title"
        aria-modal="true"
        className="my-auto w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0b1220] p-6 shadow-2xl shadow-black/50 sm:p-8"
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
              New monitor
            </p>
            <h2
              className="text-xl font-semibold text-white"
              id="add-endpoint-title"
            >
              Add an endpoint
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Choose what to check and how often.
            </p>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            className="mb-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="endpoint-name">
              Name
            </label>
            <input
              autoFocus
              className="field"
              id="endpoint-name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production API"
              required
              value={name}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="endpoint-url">
              Endpoint URL
            </label>
            <input
              className="field"
              id="endpoint-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://api.example.com/health"
              required
              type="url"
              value={url}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="endpoint-method">
                Method
              </label>
              <select
                className="field"
                id="endpoint-method"
                onChange={(event) => setMethod(event.target.value)}
                value={method}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(
                  (option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="expected-status">
                Expected status
              </label>
              <input
                className="field"
                id="expected-status"
                max={599}
                min={100}
                onChange={(event) => setExpectedStatus(Number(event.target.value))}
                required
                type="number"
                value={expectedStatus}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="check-interval">
              Check interval
            </label>
            <select
              className="field"
              id="check-interval"
              onChange={(event) => setInterval(Number(event.target.value))}
              value={interval}
            >
              <option value={60}>Every minute</option>
              <option value={300}>Every 5 minutes</option>
              <option value={600}>Every 10 minutes</option>
              <option value={1800}>Every 30 minutes</option>
            </select>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Checks are scheduled by your deployment&apos;s cron configuration.
            </p>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              className="h-11 flex-1 rounded-xl border border-white/[0.1] text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-11 flex-1 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              type="submit"
            >
              {saving ? "Adding monitor…" : "Add monitor"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PageLoader({ label }: { label: string }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        {label}
      </div>
    </main>
  );
}
