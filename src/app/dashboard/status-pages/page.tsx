"use client";

import {
  ArrowLeft,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  Globe2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { EndpointWithStatus } from "@/lib/types";

type StatusPageEndpointLink = {
  id: string;
  endpoint_id: string;
  display_name: string | null;
  endpoint: { name: string; url: string } | null;
};

type ManagedStatusPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  status_page_endpoints: StatusPageEndpointLink[];
};

export default function StatusPagesManager() {
  const { token, user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [pages, setPages] = useState<ManagedStatusPage[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!token) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const api = apiClient(token);
      const [pageData, endpointData] = await Promise.all([
        api.get("/api/status-pages") as Promise<ManagedStatusPage[]>,
        api.get("/api/endpoints") as Promise<EndpointWithStatus[]>,
      ]);
      setPages(pageData);
      setEndpoints(endpointData);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load your status pages.";
      setError(message);
      console.error("Failed to fetch status pages:", fetchError);
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

  function updateTitle(value: string) {
    setTitle(value);
    setSlug(slugify(value));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      await apiClient(token).post("/api/status-pages", {
        title,
        slug,
        description: description.trim() || null,
        endpoint_ids: selectedEndpoints,
      });
      setTitle("");
      setSlug("");
      setDescription("");
      setSelectedEndpoints([]);
      setShowForm(false);
      await fetchData(true);
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "Could not create the status page.";
      setError(message);
      console.error("Failed to create status page:", createError);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(pageSlug: string) {
    const url = `${window.location.origin}/status/${encodeURIComponent(pageSlug)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(pageSlug);
      window.setTimeout(() => setCopiedSlug(null), 2000);
    } catch (copyError) {
      setError("Could not copy the link. Open the public page and copy its URL.");
      console.error("Failed to copy status page URL:", copyError);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          Loading status pages
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
                <Globe2 size={14} />
                Public sharing
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Status pages
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Share selected service health with your customers.
              </p>
            </div>
            <div className="flex items-center gap-3">
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
                onClick={() => setShowForm((current) => !current)}
                type="button"
              >
                <Plus size={16} />
                Create page
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            <FileText className="mt-0.5 shrink-0" size={17} />
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

        {showForm && (
          <form
            className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:p-6"
            onSubmit={handleCreate}
          >
            <div className="mb-5">
              <h2 className="font-semibold text-white">Create a public page</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Anyone with the link can see selected endpoint URLs, current status,
                uptime, and incident dates.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="status-title">
                  Page title
                </label>
                <input
                  autoFocus
                  className="field"
                  id="status-title"
                  maxLength={120}
                  onChange={(event) => updateTitle(event.target.value)}
                  placeholder="Acme service status"
                  required
                  value={title}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="status-slug">
                  Public URL slug
                </label>
                <div className="flex items-center rounded-xl border border-white/[0.1] bg-white/[0.03] focus-within:border-cyan-300/50">
                  <span className="pl-3 text-xs text-slate-500">/status/</span>
                  <input
                    className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-white outline-none placeholder:text-slate-600"
                    id="status-slug"
                    maxLength={60}
                    onChange={(event) =>
                      setSlug(slugify(event.target.value))
                    }
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="acme-status"
                    required
                    value={slug}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="status-description">
                  Description <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  className="field min-h-20 resize-y"
                  id="status-description"
                  maxLength={500}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Live updates about our services."
                  value={description}
                />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm font-medium text-slate-300">
                  Monitors to show
                </legend>
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-white/[0.08] p-3">
                  {endpoints.map((endpoint) => {
                    const selected = selectedEndpoints.includes(endpoint.id);
                    return (
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-300 transition hover:bg-white/[0.04]"
                        key={endpoint.id}
                      >
                        <input
                          checked={selected}
                          className="h-4 w-4 accent-cyan-300"
                          onChange={(event) =>
                            setSelectedEndpoints((current) =>
                              event.target.checked
                                ? [...current, endpoint.id]
                                : current.filter((id) => id !== endpoint.id)
                            )
                          }
                          type="checkbox"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-white">
                            {endpoint.name}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {endpoint.url}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Select at least one monitor. Only public health information is shown.
                </p>
              </fieldset>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-10 rounded-xl border border-white/[0.1] px-4 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                disabled={saving}
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={saving || selectedEndpoints.length === 0}
                type="submit"
              >
                {saving ? (
                  <RefreshCw className="animate-spin" size={15} />
                ) : (
                  <Plus size={16} />
                )}
                {saving ? "Creating…" : "Create public page"}
              </button>
            </div>
          </form>
        )}

        {pages.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.02] px-6 py-16 text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-300">
              <Globe2 size={22} />
            </span>
            <h2 className="text-base font-semibold text-white">
              {endpoints.length === 0
                ? "Add a monitor to create a status page"
                : "No status pages yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
              {endpoints.length === 0
                ? "Create an endpoint monitor first, then select which monitors to share."
                : "Create a public page with a shareable link to your selected monitors."}
            </p>
            {endpoints.length > 0 && (
              <button
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                onClick={() => setShowForm(true)}
                type="button"
              >
                <Plus size={16} />
                Create your first page
              </button>
            )}
          </section>
        ) : (
          <section aria-label="Your public status pages" className="space-y-3">
            {pages.map((page) => {
              const publicUrl = `/status/${encodeURIComponent(page.slug)}`;
              return (
                <article
                  className="rounded-2xl border border-white/[0.08] bg-[#0b1220]/75 p-5 sm:p-6"
                  key={page.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <h2 className="truncate font-semibold text-white">
                          {page.title}
                        </h2>
                        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          Public
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-cyan-300/80">
                        {publicUrl}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {page.status_page_endpoints.length} monitor
                        {page.status_page_endpoints.length === 1 ? "" : "s"}
                        {page.description ? ` · ${page.description}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                        onClick={() => void copyLink(page.slug)}
                        type="button"
                      >
                        {copiedSlug === page.slug ? (
                          <Check size={14} />
                        ) : (
                          <Clipboard size={14} />
                        )}
                        {copiedSlug === page.slug ? "Copied" : "Copy link"}
                      </button>
                      <Link
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
                        href={publicUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink size={14} />
                        View page
                      </Link>
                    </div>
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
