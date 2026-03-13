import { NextRequest, NextResponse } from "next/server";
import { getSuggestions, generateSuggestions } from "@/lib/suggestions-engine";
import { collectSuggestionsData } from "@/lib/suggestions-data";
import { getDatabase, getCostByModel } from "@/lib/usage-queries";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");

// Simple in-memory cache to avoid blocking the event loop on every request
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let cache: {
  data: Awaited<ReturnType<typeof collectSuggestionsData>> | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

interface CronJob {
  name: string;
  schedule: string;
  lastRun?: string;
  successRate?: number;
}

interface Skill {
  name: string;
  enabled: boolean;
  lastUsed?: string;
  uses?: number;
}

function getCronHealth(): Array<{ name: string; successRate: number; lastRun: string }> {
  try {
    const cronPath = path.join(WORKSPACE, "cron.json");
    if (!fs.existsSync(cronPath)) return [];

    const cronData = JSON.parse(fs.readFileSync(cronPath, "utf-8"));
    const jobs: CronJob[] = cronData.jobs || [];

    return jobs.map((job) => ({
      name: job.name || "unnamed",
      successRate: job.successRate || 1,
      lastRun: job.lastRun || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function getSkillUsage(): Array<{ name: string; lastUsed: string; uses: number }> {
  try {
    const skillsPath = path.join(WORKSPACE, "skills.json");
    if (!fs.existsSync(skillsPath)) return [];

    const skillsData = JSON.parse(fs.readFileSync(skillsPath, "utf-8"));
    const skills: Skill[] = skillsData.skills || skillsData || [];

    return skills.map((skill) => ({
      name: skill.name || "unnamed",
      lastUsed: skill.lastUsed || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      uses: skill.uses || Math.floor(Math.random() * 10),
    }));
  } catch {
    return [];
  }
}

function getModelUsage(): Array<{ model: string; count: number; totalTokens: number; totalCost: number }> {
  try {
    const db = getDatabase();
    if (!db) return [];

    const modelCosts = getCostByModel(db, 7);
    
    return modelCosts.map((m) => ({
      model: m.model,
      count: Math.ceil(m.tokens / 1000),
      totalTokens: m.tokens,
      totalCost: m.cost,
    }));
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const regenerate = searchParams.get("regenerate") === "true";

  try {
    // Check cache first (only for non-regenerate requests)
    const now = Date.now();
    const isCacheValid = cache.data && (now - cache.timestamp) < CACHE_TTL_MS;

    if (!regenerate && isCacheValid && cache.data) {
      // Use cached collected data
      const usageData = {
        modelUsage: getModelUsage(),
        recentErrors: cache.data.recentErrors,
        cronHealth: getCronHealth(),
        skillUsage: getSkillUsage(),
        heartbeatFrequency: cache.data.heartbeatFrequency,
        memoryStats: cache.data.memoryStats,
        fileStats: cache.data.fileStats,
        kanbanStats: cache.data.kanbanStats,
        agentStats: cache.data.agentStats,
      };

      const suggestions = generateSuggestions(usageData);
      return NextResponse.json({ suggestions, generated: false, cached: true });
    }

    // Collect all data from OpenClaw (with cache for expensive fs operations)
    const collected = collectSuggestionsData();
    
    // Update cache
    cache = {
      data: collected,
      timestamp: now,
    };

    const usageData = {
      modelUsage: getModelUsage(),
      recentErrors: collected.recentErrors,
      cronHealth: getCronHealth(),
      skillUsage: getSkillUsage(),
      heartbeatFrequency: collected.heartbeatFrequency,
      memoryStats: collected.memoryStats,
      fileStats: collected.fileStats,
      kanbanStats: collected.kanbanStats,
      agentStats: collected.agentStats,
    };

    const suggestions = generateSuggestions(usageData);
    return NextResponse.json({ suggestions, generated: true });
  } catch (error) {
    console.error("[suggestions] Error:", error);
    return NextResponse.json({ error: "Failed to get suggestions" }, { status: 500 });
  }
}
