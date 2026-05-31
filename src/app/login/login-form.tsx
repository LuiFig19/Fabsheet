"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestMagicLink } from "@/lib/login-actions";
import { AlertTriangle, Check, Loader2, Mail } from "lucide-react";

export function LoginForm({ nextUrl, initialError }: { nextUrl: string; initialError: string | null }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [recipient, setRecipient] = useState<string | null>(null);

  // Absolute callback URL for BetterAuth to redirect to after the magic-link
  // click. App is served at the domain root now, so it's just origin + path.
  function absoluteCallback(path: string): string {
    if (typeof window === "undefined") return path;
    const clean = path.startsWith("/") ? path : `/${path}`;
    return window.location.origin + clean;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) {
      setError("Enter your email.");
      return;
    }
    const callbackURL = absoluteCallback(nextUrl);
    startTransition(async () => {
      const res = await requestMagicLink(email, callbackURL);
      if (res.ok) {
        setRecipient(email);
        setSent(true);
      } else {
        setError(res.error ?? "Could not send the link.");
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
          <Check className="h-6 w-6" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-white">Check your email</h3>
          <p className="text-sm leading-relaxed text-slate-400">
            If <span className="font-medium text-slate-200">{recipient}</span> has access, a sign-in link is on its way. The link expires in 15 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Email</span>
        <Input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          autoFocus
          className="h-12 border-white/10 bg-white/[0.04] text-base text-white placeholder:text-slate-500 focus-visible:ring-blue-400/60"
        />
      </label>
      <Button
        type="submit"
        disabled={pending}
        className="h-12 w-full bg-white text-base font-semibold text-slate-900 shadow-lg shadow-blue-500/10 transition-all hover:bg-slate-100 hover:shadow-blue-500/20 disabled:opacity-80"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {pending ? "Sending sign-in link..." : "Email me a sign-in link"}
      </Button>
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-sm text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
