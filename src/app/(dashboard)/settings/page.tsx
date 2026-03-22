import { getSystemData } from "@/operations/system-ops";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let initialSystemData = null;
  try {
    initialSystemData = await getSystemData();
  } catch (error) {
    console.error("Failed to fetch initial system data:", error);
  }

  return <SettingsClient initialSystemData={initialSystemData} />;
}
