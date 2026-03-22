import { getDiscoveredServices } from "@/operations/service-discovery-ops";

import LogsClient from "./LogsClient";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const services = await getDiscoveredServices();
  
  return <LogsClient initialServices={services} />;
}
