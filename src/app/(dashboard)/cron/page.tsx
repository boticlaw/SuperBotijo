import { getOpenClawCronJobs } from "@/operations/openclaw-cron-ops";
import { getSystemCronJobs } from "@/operations/system-cron-ops";
import { getHeartbeatStatus } from "@/operations/heartbeat-ops";

import CronClient from "./CronClient";

export const dynamic = "force-dynamic";

export default async function CronPage() {
  const [openclawJobs, systemJobs, heartbeat] = await Promise.all([
    getOpenClawCronJobs(),
    getSystemCronJobs(),
    getHeartbeatStatus(),
  ]);
  
  return (
    <CronClient
      initialData={{
        openclawJobs,
        systemJobs,
        heartbeat,
      }}
    />
  );
}
