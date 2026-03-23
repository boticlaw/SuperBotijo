import fs from "fs";
import path from "path";

import { NextResponse } from "next/server";

import { getSystemData } from "@/operations/system-ops";

const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const systemInfo = await getSystemData();
    return NextResponse.json(systemInfo);
  } catch (error) {
    console.error("[system] GET error:", error);
    return NextResponse.json({ error: "Failed to read system info" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();

    if (action === "change_password") {
      const { currentPassword, newPassword } = data;

      let envContent = "";
      try {
        envContent = fs.readFileSync(ENV_LOCAL_PATH, "utf-8");
      } catch {
        return NextResponse.json({ error: "Could not read configuration" }, { status: 500 });
      }

      const currentPassMatch = envContent.match(/ADMIN_PASSWORD=(.+)/);
      const storedPassword = currentPassMatch?.[1]?.trim();

      if (storedPassword !== currentPassword) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }

      const newEnvContent = envContent.replace(/ADMIN_PASSWORD=.*/, `ADMIN_PASSWORD=${newPassword}`);
      fs.writeFileSync(ENV_LOCAL_PATH, newEnvContent);

      return NextResponse.json({ success: true, message: "Password updated successfully" });
    }

    if (action === "clear_activity_log") {
      const activitiesPath = path.join(process.cwd(), "data", "activities.json");
      fs.writeFileSync(activitiesPath, "[]");
      return NextResponse.json({ success: true, message: "Activity log cleared" });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
