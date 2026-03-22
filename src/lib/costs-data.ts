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

export interface CostData {
  today: number;
  yesterday: number;
  thisMonth: number;
  lastMonth: number;
  projected: number;
  budget: number;
  alertThreshold: number;
  byAgent: Array<{ agent: string; cost: number; tokens: number }>;
  byModel: Array<{ model: string; cost: number; tokens: number }>;
  daily: Array<{ date: string; cost: number; input: number; output: number }>;
  hourly: Array<{ hour: string; cost: number }>;
  message?: string;
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

export async function getCostData(timeframe: string = "30d"): Promise<CostData> {
  const days = parseInt(timeframe.replace(/\D/g, ""), 10) || 30;
  const budgetSettings = getBudgetSettings();

  try {
    await ensureFreshData();

    const db = getDatabase(DB_PATH);

    if (!db) {
      return {
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
      };
    }

    const summary = getCostSummary(db);
    const byAgent = getCostByAgent(db, days);
    const byModel = getCostByModel(db, days);
    const daily = getDailyCost(db, days);
    const hourly = getHourlyCost(db);

    db.close();

    return {
      ...summary,
      budget: budgetSettings.budget,
      alertThreshold: budgetSettings.alertThreshold,
      byAgent,
      byModel,
      daily,
      hourly,
    };
  } catch (error) {
    console.error("Error fetching cost data:", error);
    throw error;
  }
}

export async function saveBudgetSettingsServer(newBudget: number): Promise<BudgetSettings> {
  const currentSettings = getBudgetSettings();
  const newSettings: BudgetSettings = {
    budget: Math.round(newBudget * 100) / 100,
    alertThreshold: currentSettings.alertThreshold,
  };

  const dir = path.dirname(BUDGET_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(BUDGET_PATH, JSON.stringify(newSettings, null, 2));

  return newSettings;
}
