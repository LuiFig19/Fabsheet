import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { fmtMoney } from "@/lib/utils";
import { getTenantContext, tenantWhere } from "@/lib/tenant";
import {
  addDescription,
  addEmployee,
  addLaborCode,
  saveKeys,
  toggleDescription,
  toggleEmployee,
  toggleLaborCode,
  updateCompany,
  updateOcrSettings,
} from "@/lib/settings-actions";

export const dynamic = "force-dynamic";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function SettingsPage() {
  const ctx = await getTenantContext();
  const tw = tenantWhere(ctx);
  const [company, employees, codes, descriptions, usage] = await Promise.all([
    prisma.company.findFirst({ where: tw }),
    prisma.employee.findMany({ where: tw, orderBy: { name: "asc" } }),
    prisma.laborCode.findMany({ where: tw, orderBy: { code: "asc" } }),
    prisma.taskDescription.findMany({ where: tw, orderBy: { name: "asc" } }),
    prisma.auditLog.aggregate({
      where: { ...tw, action: "ocr_call", createdAt: { gte: startOfToday() } },
      _count: true,
      _sum: { inputTokens: true, outputTokens: true, costUsd: true },
    }),
  ]);

  const anthropicSource = process.env.ANTHROPIC_API_KEY
    ? "environment"
    : company?.anthropicKeyEnc
      ? "settings"
      : null;
  const resendSource = process.env.RESEND_API_KEY ? "environment" : company?.resendKeyEnc ? "settings" : null;

  const callsToday = usage._count;
  const cap = company?.dailyApiCap ?? 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Company info, reference data, OCR controls, and API usage. Single tenant.</p>
      </div>

      {/* API usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Claude Vision API usage (today)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Usage label="Calls today" value={`${callsToday} / ${cap}`} warn={callsToday >= cap} />
            <Usage label="Input tokens" value={String(usage._sum.inputTokens ?? 0)} />
            <Usage label="Output tokens" value={String(usage._sum.outputTokens ?? 0)} />
            <Usage label="Est. cost today" value={fmtMoney(usage._sum.costUsd ?? 0)} />
          </div>
          {callsToday >= cap && (
            <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
              Daily cap reached. Further uploads fall back to the mock extractor until tomorrow.
            </p>
          )}
        </CardContent>
      </Card>

      {/* OCR + keys */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">OCR settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateOcrSettings} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-sm font-medium">Confidence threshold (0 to 1)</span>
                <Input name="ocrThreshold" type="number" step="0.05" min="0" max="1" defaultValue={company?.ocrThreshold ?? 0.7} />
                <span className="text-xs text-muted-foreground">Fields below this are flagged yellow in Review.</span>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium">Daily API call cap</span>
                <Input name="dailyApiCap" type="number" step="1" min="0" defaultValue={company?.dailyApiCap ?? 100} />
                <span className="text-xs text-muted-foreground">Over this, uploads fall back to mock to protect the budget.</span>
              </label>
              <Button type="submit">Save OCR settings</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">API keys</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveKeys} className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Anthropic API key</span>
                  {anthropicSource ? (
                    <Badge variant="success">configured ({anthropicSource})</Badge>
                  ) : (
                    <Badge variant="danger">not set</Badge>
                  )}
                </div>
                <Input name="anthropicKey" type="password" placeholder={anthropicSource ? "Leave blank to keep current" : "sk-ant-..."} />
                <span className="text-xs text-muted-foreground">Stored encrypted at rest. The environment variable takes precedence.</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Resend API key</span>
                  {resendSource ? (
                    <Badge variant="success">configured ({resendSource})</Badge>
                  ) : (
                    <Badge variant="muted">not set</Badge>
                  )}
                </div>
                <Input name="resendKey" type="password" placeholder={resendSource ? "Leave blank to keep current" : "re_..."} />
                <span className="text-xs text-muted-foreground">Without this, the email button logs a "would send" notice.</span>
              </div>
              <Button type="submit">Save keys</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Company */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Company</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateCompany} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium">Name</span>
              <Input name="name" defaultValue={company?.name ?? "Raven's Marine"} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Phone</span>
              <Input name="phone" defaultValue={company?.phone ?? ""} />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm font-medium">Address</span>
              <Input name="address" defaultValue={company?.address ?? ""} />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Default report recipients</span>
              <Input name="defaultEmailTo" defaultValue={company?.defaultEmailTo ?? ""} placeholder="office@ravensmarine.com" />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Email From address</span>
              <Input name="resendFrom" defaultValue={company?.resendFrom ?? ""} placeholder="Raven's Marine <reports@domain.com>" />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Save company</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reference data */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ListCard
          title={`Employees (${employees.filter((e) => e.active).length} active)`}
          addAction={addEmployee}
          addFields={[{ name: "name", placeholder: "New employee" }]}
          items={employees.map((e) => ({ id: e.id, label: e.name, active: e.active }))}
          toggleAction={toggleEmployee}
        />
        <ListCard
          title={`Labor codes (${codes.filter((c) => c.active).length} active)`}
          addAction={addLaborCode}
          addFields={[
            { name: "code", placeholder: "290", className: "w-20" },
            { name: "description", placeholder: "Description" },
          ]}
          items={codes.map((c) => ({ id: c.id, label: `${c.code} ${c.description}`, active: c.active }))}
          toggleAction={toggleLaborCode}
        />
        <ListCard
          title={`Descriptions (${descriptions.filter((d) => d.active).length} active)`}
          addAction={addDescription}
          addFields={[{ name: "name", placeholder: "New description" }]}
          items={descriptions.map((d) => ({ id: d.id, label: d.name, active: d.active }))}
          toggleAction={toggleDescription}
        />
      </div>
    </div>
  );
}

function Usage({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${warn ? "text-amber-600" : ""}`}>{value}</div>
    </div>
  );
}

function ListCard({
  title,
  addAction,
  addFields,
  items,
  toggleAction,
}: {
  title: string;
  addAction: (fd: FormData) => Promise<void>;
  addFields: { name: string; placeholder: string; className?: string }[];
  items: { id: string; label: string; active: boolean }[];
  toggleAction: (fd: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form action={addAction} className="flex gap-2">
          {addFields.map((f) => (
            <Input key={f.name} name={f.name} placeholder={f.placeholder} className={f.className} />
          ))}
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
        <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded border px-2 py-1">
              <span className={it.active ? "" : "text-muted-foreground line-through"}>{it.label}</span>
              <form action={toggleAction}>
                <input type="hidden" name="id" value={it.id} />
                <button type="submit" className="text-xs text-muted-foreground underline hover:text-foreground">
                  {it.active ? "deactivate" : "activate"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
