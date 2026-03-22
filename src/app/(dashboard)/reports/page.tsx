import { getReportsList } from "@/operations/reports-ops";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const initialReports = await getReportsList();

  return <ReportsClient initialReports={initialReports} />;
}
