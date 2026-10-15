"use client";

import { Activity, ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, login, register, isLoading } = useAuth();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  if (isLoading || user) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </main>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name.trim());
      }
      router.replace("/dashboard");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden px-5 py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-[-10rem] h-[34rem] w-[34rem] rounded-full bg-cyan-500/[0.08] blur-[120px]" />
        <div className="absolute -right-40 bottom-[-12rem] h-[36rem] w-[36rem] rounded-full bg-blue-500/[0.08] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/[0.09] bg-[#0b1220]/90 shadow-2xl shadow-black/40 backdrop-blur-xl md:grid-cols-[1fr_0.92fr]">
        <section className="hidden flex-col justify-between border-r border-white/[0.08] p-10 md:flex lg:p-14">
          <div>
            <Brand />
            <div className="mt-24 max-w-md">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Reliability, at a glance
              </p>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white lg:text-5xl">
                Know when your
                <span className="block bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  APIs need you.
                </span>
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-slate-400">
                Keep a steady pulse on uptime, response times, and the endpoints
                your team depends on.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            Built for clear, actionable monitoring
          </div>
        </section>

        <section className="p-7 sm:p-10 lg:p-14">
          <div className="mb-9 md:hidden">
            <Brand />
          </div>
          <div className="mb-8">
            <p className="mb-2 text-sm font-medium text-cyan-300">
              {isLogin ? "Welcome back" : "Get started"}
            </p>
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              {isLogin ? "Sign in to PulseCheck" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {isLogin
                ? "Your services are one sign-in away."
                : "Start monitoring your APIs in just a few steps."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="name">
                  Name
                </label>
                <input
                  autoComplete="name"
                  className="field"
                  id="name"
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  required
                  value={name}
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="field"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="field pr-12"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-slate-200"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                aria-live="polite"
                className="rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-200"
                role="alert"
              >
                {error}
              </div>
            )}

            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? isLogin
                  ? "Signing in…"
                  : "Creating account…"
                : isLogin
                  ? "Sign in"
                  : "Create account"}
              {!submitting && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-400">
            {isLogin ? "New to PulseCheck?" : "Already have an account?"}{" "}
            <button
              className="font-medium text-cyan-300 transition hover:text-cyan-200"
              onClick={() => {
                setIsLogin((value) => !value);
                setError("");
              }}
              type="button"
            >
              {isLogin ? "Create an account" : "Sign in"}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
        <Activity size={20} strokeWidth={2.4} />
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">
        Pulse<span className="text-cyan-300">Check</span>
      </span>
      <span className="ml-1 flex h-5 items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.08] px-2 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
        <CheckCircle2 size={11} />
        Live
      </span>
    </div>
  );
}
