import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Progress probe: consumes the uploaded bytes so the browser's XHR
// upload.onprogress fires for a real (not fake) progress bar. The actual
// persistence + extraction happens in the uploadAndExtract server action.
export async function POST(req: NextRequest) {
  await req.arrayBuffer(); // drain the body
  return NextResponse.json({ ok: true });
}
