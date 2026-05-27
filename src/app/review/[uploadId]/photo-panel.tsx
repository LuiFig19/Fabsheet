"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCw, ExternalLink, ImageIcon, FileText } from "lucide-react";

/**
 * Collapsible image/PDF preview of the original timesheet. Manager can zoom
 * in to read a smudged field next to the extracted row. Image lives in R2
 * (signed URL) or local disk (dev). Lazy-loaded so opening the Review screen
 * isn't blocked on the photo bytes.
 */
export function PhotoPanel({ url, isPdf, fileName }: { url: string; isPdf: boolean; fileName: string }) {
  const [open, setOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="flex items-center gap-2 text-foreground">
          {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
          Original timesheet
        </CardTitle>
        <div className="flex items-center gap-1">
          {!isPdf && open && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotate">
                <RotateCw className="h-4 w-4" />
              </Button>
            </>
          )}
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title="Open full size">
            <ExternalLink className="h-4 w-4" />
          </a>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen((o) => !o)} title={open ? "Hide" : "Show"}>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent>
          {isPdf ? (
            <div className="flex items-center justify-center rounded-md border bg-muted/40 p-8">
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-primary underline">
                <FileText className="h-4 w-4" /> Open {fileName}
              </a>
            </div>
          ) : (
            <div className="overflow-auto rounded-md border bg-muted/30" style={{ maxHeight: "70vh" }}>
              <div className="flex justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Original timesheet"
                  loading="lazy"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: "center top",
                    transition: "transform 120ms ease",
                    maxWidth: "100%",
                    height: "auto",
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
