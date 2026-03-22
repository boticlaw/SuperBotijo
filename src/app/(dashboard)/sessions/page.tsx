import { getSessionsList } from "@/operations/sessions-list-ops";
import SessionsClient from "./SessionsClient";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const initialSessions = await getSessionsList();

  return <SessionsClient initialSessions={initialSessions} />;
}
