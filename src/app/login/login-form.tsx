"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { signIn } from "@/lib/auth-client";
import { Mail, Check, AlertTriangle } from "lucide-react";

export function LoginForm({ nextUrl, initialError }: { nextUrl: string; initialError: string | null }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  // BetterAuth redirects to callbackURL after a successful magic-link click.
  // We must include Next's basePath (the access prefix) or the browser lands
  // on an unrouted path and shows a blank page. Build the absolute URL from
  // the current location so prefix changes never break the redirect.
  function absoluteCallback(path: string): string {
    if (typeof window === "undefined") return path;
    const m = /^(\/r\/[A-Za-z0-9_-]+)(?:\/|$)/.exec(window.location.pathname);
    const prefix = m ? m[1] : "";
    const clean = path.startsWith("/") ? path : `/${path}`;
    return window.location.origin + prefix + clean;
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
    startTransition(async () => {
      try {
        const res = await signIn.magicLink({ email, callbackURL: absoluteCallback(nextUrl) });
        if (res && typeof res === "object" && "error" in res && res.error) {
          // Surface BetterAuth's message so misconfig is obvious to the admin,
          // but still tell the end user a generic line.
          console.error("[login] BetterAuth error", res.error);
          setError(`Could not send the link. (${(res.error as { message?: string }).message ?? "unknown error"})`);
          return;
        }
        setSent(true);
      } catch (err) {
        console.error("[login] signIn threw", err);
        const msg = err instanceof Error ? err.message : "Network error.";
        setError(`Could not send the link. (${msg})`);
      }
    });
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-5 text-center">
          <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-5 w-5" />
          </div>
          <h2 className="text-base font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            If your address has access, a sign-in link is on its way. The link expires in 15 minutes.
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSent(false)}>Use a different email</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email</span>
            <Input name="email" type="email" placeholder="you@company.com" required autoFocus className="min-h-[44px]" />
          </label>
          <Button type="submit" disabled={pending} className="min-h-[44px] w-full">
            <Mail className="h-4 w-4" />
            {pending ? "Sending..." : "Email me a sign-in link"}
          </Button>
        </form>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
