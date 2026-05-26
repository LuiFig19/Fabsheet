import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "./upload-form";

export const dynamic = "force-dynamic";
// Pro plan: server actions on this route may take up to 60s.
export const maxDuration = 60;

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload a timesheet</h1>
        <p className="text-sm text-muted-foreground">
          Snap a photo of the paper sheet. The system reads the name, date, and rows automatically. You only fix what looks off.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New timesheet</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
    </div>
  );
}
