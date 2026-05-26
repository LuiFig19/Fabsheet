"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { updateUploadHeader } from "@/lib/actions";
import { Pencil, Check, X, User, Calendar } from "lucide-react";

export function HeaderEdit({
  uploadId,
  employeeId,
  employeeName,
  date,
  employees,
}: {
  uploadId: string;
  employeeId: string | null;
  employeeName: string | null;
  date: string;
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<"employee" | "date" | null>(null);
  const [pending, startTransition] = useTransition();

  function save(field: "employee" | "date", value: string) {
    const fd = new FormData();
    fd.set("uploadId", uploadId);
    fd.set(field === "employee" ? "employeeId" : "date", value);
    startTransition(async () => {
      await updateUploadHeader(fd);
      setEditing(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
        <Field icon={User} label="Employee" detected={employeeName ?? "(none auto-detected)"} editing={editing === "employee"} onEdit={() => setEditing("employee")} onCancel={() => setEditing(null)}>
          <Select
            defaultValue={employeeId ?? ""}
            onChange={(e) => save("employee", e.target.value)}
            disabled={pending}
            className="min-h-[44px]"
          >
            <option value="">-- pick employee --</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </Field>

        <Field icon={Calendar} label="Work date" detected={date} editing={editing === "date"} onEdit={() => setEditing("date")} onCancel={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget).get("date");
              if (typeof v === "string" && v) save("date", v);
            }}
            className="flex gap-1"
          >
            <Input type="date" name="date" defaultValue={date} className="min-h-[44px]" disabled={pending} />
            <button type="submit" className="rounded-md bg-primary px-3 text-primary-foreground" disabled={pending}>
              <Check className="h-4 w-4" />
            </button>
          </form>
        </Field>
      </CardContent>
    </Card>
  );
}

function Field({
  icon: Icon, label, detected, editing, onEdit, onCancel, children,
}: {
  icon: typeof User;
  label: string;
  detected: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      {editing ? (
        <div className="flex items-start gap-2">
          <div className="flex-1">{children}</div>
          <button type="button" onClick={onCancel} className="rounded-md p-2 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
          <span className="text-sm font-medium">{detected}</span>
          <button type="button" onClick={onEdit} className="flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground">
            <Pencil className="h-3 w-3" /> change
          </button>
        </div>
      )}
    </div>
  );
}
