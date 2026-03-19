import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import {
  getDatabase,
  getCostSummary,
  getCostByAgent,
  getCostByModel,
  getDailyCost,
  getHourlyCost,
} from "@/lib/usage-queries";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "usage-tracking.db");
const BUDGET_PATH = path.join(process.cwd(), "data", "budget-settings.json");
const DEFAULT_BUDGET = 100.0;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

interface BudgetSettings {
  budget: number;
  alertThreshold: number;
}

function getBudgetSettings(): BudgetSettings {
  try {
    if (fs.existsSync(BUDGET_PATH)) {
      const data = fs.readFileSync(BUDGET_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch {
    console.error("Failed to read budget settings, using defaults");
  }
  return { budget: DEFAULT_BUDGET, alertThreshold: 80 };
}

function saveBudgetSettings(settings: BudgetSettings): void {
  const dir = path.dirname(BUDGET_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(BUDGET_PATH, JSON.stringify(settings, null, 2));
}

function getLatestCollectionTimestamp(db: Database.Database): number | null {
  try {
    const result = db.prepare(`
      SELECT MAX(timestamp) as latest FROM usage_snapshots
    `).get() as { latest: number | null } | undefined;
    return result?.latest ?? null;
  } catch {
    return null;
  }
}

async function ensureFreshData(): Promise<boolean> {
  if (!fs.existsSync(DB_PATH)) {
    return false;
  }

  const db = new Database(DB_PATH, { readonly: true });
  try {
    const latestTs = getLatestCollectionTimestamp(db);
    db.close();

    if (latestTs === null) {
      return false;
    }

    const age = Date.now() - latestTs;
    if (age > STALE_THRESHOLD_MS) {
      const { collectUsageFromFilesAndSave } = await import("@/lib/usage-collector");
      await collectUsageFromFilesAndSave(DB_PATH);
      return true;
    }
    return false;
  } catch {
    db.close();
    return false;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeframe = searchParams.get("timeframe") || "30d";
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;
  const budgetSettings = getBudgetSettings();

  try {
    await ensureFreshData();

    const db = getDatabase(DB_PATH);

    if (!db) {
      return NextResponse.json({
        today: 0,
        yesterday: 0,
        thisMonth: 0,
        lastMonth: 0,
        projected: 0,
        budget: budgetSettings.budget,
        alertThreshold: budgetSettings.alertThreshold,
        byAgent: [],
        byModel: [],
        daily: [],
        hourly: [],
        message: "No usage data collected yet. Run collect-usage script first.",
      });
    }

    const summary = getCostSummary(db);
    const byAgent = getCostByAgent(db, days);
    const byModel = getCostByModel(db, days);
    const daily = getDailyCost(db, days);
    const hourly = getHourlyCost(db);

    db.close();

    return NextResponse.json({
      ...summary,
      budget: budgetSettings.budget,
      alertThreshold: budgetSettings.alertThreshold,
      byAgent,
      byModel,
      daily,
      hourly,
    });
  } catch (error) {
    console.error("Error fetching cost data:", error);
    return NextResponse.json(
      { error: "Failed to fetch cost data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { budget, alertThreshold } = body;

    if (typeof budget !== "number" || budget <= 0) {
      return NextResponse.json(
        { error: "Budget must be a positive number" },
        { status: 400 }
      );
    }

    const currentSettings = getBudgetSettings();
    const newSettings: BudgetSettings = {
      budget: Math.round(budget * 100) / 100,
      alertThreshold: typeof alertThreshold === "number" ? alertThreshold : currentSettings.alertThreshold,
    };

    saveBudgetSettings(newSettings);

    return NextResponse.json({
      success: true,
      ...newSettings,
    });
  } catch (error) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: "Failed to update budget" },
      { status: 500 }
    );
  }
}
