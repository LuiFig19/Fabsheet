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
      const res = await signIn.magicLink({ email, callbackURL: nextUrl });
      if ("error" in res && res.error) {
        // Generic message so we don't leak which emails exist.
        setError("Could not send the link. Try again in a moment.");
        return;
      }
      setSent(true);
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
