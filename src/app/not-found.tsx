import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Compass className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">That page does not exist. Here is where you can go instead.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="min-h-[44px]"><Link href="/dashboard">Dashboard</Link></Button>
        <Button asChild variant="outline" className="min-h-[44px]"><Link href="/upload">Upload</Link></Button>
        <Button asChild variant="outline" className="min-h-[44px]"><Link href="/review">Review</Link></Button>
        <Button asChild variant="outline" className="min-h-[44px]"><Link href="/jobs">Jobs</Link></Button>
      </div>
    </div>
  );
}
