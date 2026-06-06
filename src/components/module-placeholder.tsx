import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ModulePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <Badge variant="muted" className="mb-2">Optional module</Badge>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-foreground">Module-ready foundation</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>This page is intentionally a placeholder. The platform navigation, permission gate, and tenant boundary are already in place.</p>
          <p>When this add-on is sold, it can be built without disturbing Raven's existing timesheet, OCR, review, job costing, or reporting workflows.</p>
        </CardContent>
      </Card>
    </div>
  );
}
