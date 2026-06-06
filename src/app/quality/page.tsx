import { ModulePlaceholder } from "@/components/module-placeholder";
import { requirePermission } from "@/lib/access";

export default async function QualityPage() {
  await requirePermission("modules.view");
  return <ModulePlaceholder title="Quality Control" description="Future add-on for inspection checklists, photo proof, defect notes, and sign-off by job or unit." />;
}
