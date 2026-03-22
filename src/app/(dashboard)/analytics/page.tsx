import { getAnalyticsData } from "@/lib/analytics-data";
import { getCostData } from "@/lib/costs-data";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [initialAnalyticsData, initialCostData] = await Promise.all([
    getAnalyticsData(),
    getCostData("30d").catch(() => null),
  ]);

  return (
    <AnalyticsClient
      initialAnalyticsData={initialAnalyticsData}
      initialCostData={initialCostData}
    />
  );
}
