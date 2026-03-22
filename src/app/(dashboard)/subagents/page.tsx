import { getSubagentsData } from "@/operations/subagent-ops";
import SubagentsClient from "./SubagentsClient";

export const dynamic = "force-dynamic";

export default async function SubagentsPage() {
  const initialData = getSubagentsData();
  return <SubagentsClient initialData={initialData} />;
}
