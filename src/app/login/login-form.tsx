"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { requestMagicLink } from "@/lib/auth-actions";
import { Mail } from "lucide-react";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; devLink?: string } | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => setResult(await requestMagicLink(fd)));
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Work email</span>
            <Input name="email" type="email" placeholder="you@company.com" required className="min-h-[44px]" />
          </label>
          <Button type="submit" disabled={pending} className="min-h-[44px] w-full">
            <Mail className="h-4 w-4" /> {pending ? "Sending..." : "Email me a sign-in link"}
          </Button>
        </form>
        {result && (
          <div className="mt-3 text-sm">
            <p className={result.ok ? "text-emerald-700" : "text-destructive"}>{result.message}</p>
            {result.devLink && (
              <a href={result.devLink} className="mt-1 block break-all text-xs text-blue-600 underline">
                {result.devLink}
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
