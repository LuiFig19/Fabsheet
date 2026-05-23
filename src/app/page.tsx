import { redirect } from "next/navigation";

// The dashboard lives at /dashboard so the access-prefixed URL reads
// /<prefix>/dashboard. Root redirects there.
export default function RootIndex() {
  redirect("/dashboard");
}
