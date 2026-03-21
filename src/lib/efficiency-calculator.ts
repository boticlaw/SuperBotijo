/**
 * Efficiency Calculator
 * Calculates efficiency scores based on activity success rates and token usage
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const ACTIVITIES_DB = path.join(process.cwd(), "data", "activities.db");
const USAGE_DB = path.join(process.cwd(), "data", "usage-tracking.db");

export interface EfficiencyScore {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    successRate: number; // 0-100
    taskCompletion: number; // 0-100
    tokenEfficiency: number; // 0-100
  };
  breakdown: {
    totalActivities: number;
    successfulActivities: number;
    failedActivities: number;
    totalTokens: number;
    usefulTokens: number; // estimated
  };
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export interface EfficiencyHistory {
  date: string;
  score: number;
  activities: number;
  successRate: number;
}

/**
 * Calculate efficiency score for a given time period
 */
export function calculateEfficiencyScore(days: number = 7): EfficiencyScore {
  // Get activities database
  let activitiesDb: Database.Database | null = null;
  let usageDb: Database.Database | null = null;

  try {
    // Initialize activities data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString();

    let totalActivities = 0;
    let successfulActivities = 0;
    let failedActivities = 0;

    if (fs.existsSync(ACTIVITIES_DB)) {
      activitiesDb = new Database(ACTIVITIES_DB, { readonly: true });

      const stats = activitiesDb.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors,
          SUM(CASE WHEN status IN ('pending', 'running') THEN 1 ELSE 0 END) as pending
        FROM activities
        WHERE timestamp >= ?
      `).get(cutoffStr) as {
        total: number;
        success: number;
        errors: number;
        pending: number;
      };

      totalActivities = stats.total || 0;
      successfulActivities = stats.success || 0;
      failedActivities = stats.errors || 0;
    }

    // Get usage data for token efficiency
    let totalTokens = 0;
    let outputTokens = 0;

    if (fs.existsSync(USAGE_DB)) {
      usageDb = new Database(USAGE_DB, { readonly: true });

      const usageCutoff = new Date();
      usageCutoff.setDate(usageCutoff.getDate() - days);
      const usageCutoffStr = usageCutoff.toISOString().split("T")[0];

      const usageStats = usageDb.prepare(`
        SELECT 
          SUM(total_tokens) as total,
          SUM(output_tokens) as output
        FROM usage_snapshots
        WHERE date >= ?
      `).get(usageCutoffStr) as {
        total: number;
        output: number;
      };

      totalTokens = usageStats.total || 0;
      outputTokens = usageStats.output || 0;
    }

    // Calculate components
    const successRate = totalActivities > 0 
      ? (successfulActivities / totalActivities) * 100 
      : 0;

    // Task completion: successful / (successful + failed), excluding pending
    const completedTasks = successfulActivities + failedActivities;
    const taskCompletion = completedTasks > 0 
      ? (successfulActivities / completedTasks) * 100 
      : 0;

    // Token efficiency: output tokens are "useful", ratio of output/total
    const tokenEfficiency = totalTokens > 0 
      ? (outputTokens / totalTokens) * 100 
      : 0;

    // Calculate overall score (weighted average)
    // Success rate: 40%, Task completion: 40%, Token efficiency: 20%
    const score = (successRate * 0.4) + (taskCompletion * 0.4) + (tokenEfficiency * 0.2);

    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    // Calculate trend (compare with previous period)
    const previousCutoff = new Date();
    previousCutoff.setDate(previousCutoff.getDate() - (days * 2));
    const previousCutoffStr = previousCutoff.toISOString();
    const midCutoffStr = cutoffDate.toISOString();

    let previousSuccessRate = 0;
    if (activitiesDb) {
      const previousStats = activitiesDb.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
        FROM activities
        WHERE timestamp >= ? AND timestamp < ?
      `).get(previousCutoffStr, midCutoffStr) as {
        total: number;
        success: number;
      };

      previousSuccessRate = (previousStats.total || 0) > 0 
        ? (previousStats.success || 0) / previousStats.total * 100 
        : 0;
    }

    const trendPercent = previousSuccessRate > 0 
      ? ((successRate - previousSuccessRate) / previousSuccessRate) * 100 
      : 0;

    const trend: 'up' | 'down' | 'stable' = 
      Math.abs(trendPercent) < 5 ? 'stable' : 
      trendPercent > 0 ? 'up' : 'down';

    return {
      score: Math.round(score * 10) / 10,
      grade,
      components: {
        successRate: Math.round(successRate * 10) / 10,
        taskCompletion: Math.round(taskCompletion * 10) / 10,
        tokenEfficiency: Math.round(tokenEfficiency * 10) / 10,
      },
      breakdown: {
        totalActivities,
        successfulActivities,
        failedActivities,
        totalTokens,
        usefulTokens: outputTokens,
      },
      trend,
      trendPercent: Math.round(Math.abs(trendPercent) * 10) / 10,
    };

  } finally {
    if (activitiesDb) activitiesDb.close();
    if (usageDb) usageDb.close();
  }
}

/**
 * Get efficiency score history for the last N days
 */
export function getEfficiencyHistory(days: number = 7): EfficiencyHistory[] {
  const history: EfficiencyHistory[] = [];

  if (!fs.existsSync(ACTIVITIES_DB)) {
    return history;
  }

  const db = new Database(ACTIVITIES_DB, { readonly: true });

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get daily stats
    const dailyStats = db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
      FROM activities
      WHERE timestamp >= ?
      GROUP BY DATE(timestamp)
      ORDER BY date ASC
    `).all(cutoffDate.toISOString()) as Array<{
      date: string;
      total: number;
      success: number;
    }>;

    for (const day of dailyStats) {
      const successRate = day.total > 0 ? (day.success / day.total) * 100 : 0;
      
      history.push({
        date: day.date.slice(5), // MM-DD format
        score: Math.round(successRate * 10) / 10,
        activities: day.total,
        successRate: Math.round(successRate * 10) / 10,
      });
    }

    return history;
  } finally {
    db.close();
  }
}
