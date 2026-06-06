import { ModulePlaceholder } from "@/components/module-placeholder";
import { requirePermission } from "@/lib/access";

export default async function IncentivesPage() {
  await requirePermission("modules.view");
  return <ModulePlaceholder title="Leaderboard / Incentives" description="Future add-on for production scorecards, incentive tracking, employee trends, and transparent weekly recognition." />;
}
