"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted", className)}
      {...props}
    />
  );
}
export function AvatarFallback({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex h-full w-full items-center justify-center text-sm font-medium uppercase text-muted-foreground", className)}>
      {children}
    </div>
  );
}
