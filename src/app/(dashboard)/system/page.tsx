import { getSystemMonitorData } from "@/operations/system-monitor-ops";

import SystemClient from "./SystemClient";
export const dynamic = "force-dynamic";

export default async function SystemPage() {
  const data = await getSystemMonitorData();
  
  return <SystemClient initialData={data} />;
}
