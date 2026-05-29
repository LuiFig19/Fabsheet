"use client";

// Catches errors in the root layout itself (where the normal error.tsx can't
// render because the layout failed). Must include its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#0A1929", color: "#fff" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
            Reload the page. If it persists, contact luis@fabsheet.org
            {error.digest ? ` (ref ${error.digest})` : ""}.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 16, background: "#fff", color: "#0A1929", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 500, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
