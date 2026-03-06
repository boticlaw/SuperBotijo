/**
 * Cron Operations - Business logic for cron job management
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import type { OperationResult, PaginationParams, PaginatedResult } from './index';

const execAsync = promisify(exec);

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  type: 'system' | 'openclaw';
}

export interface CronRun {
  id: string;
  jobId: string;
  status: 'running' | 'success' | 'failed';
  startTime: string;
  endTime?: string;
  output?: string;
  error?: string;
  duration?: number;
}

// In-memory store for runs (would be DB in production)
const cronRuns = new Map<string, CronRun[]>();

/**
 * Parse cron expression to human-readable format
 */
export function parseCronExpression(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) return expression;

  const [min, hour] = parts;

  // Common patterns
  if (min === '*' && hour === '*') return 'Every minute';
  if (min === '0' && hour === '*') return 'Every hour';
  if (min === '0' && hour === '0') return 'Daily at midnight';
  if (min === '0' && hour !== '*') return `Daily at ${hour}:00`;
  if (min.startsWith('*/') && hour === '*') return `Every ${min.slice(2)} minutes`;
  if (min === '0' && hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;

  return expression;
}

/**
 * Calculate next run time from cron expression
 */
export function calculateNextRun(expression: string): Date | null {
  try {
    const parts = expression.split(' ');
    if (parts.length !== 5) return null;

    const now = new Date();
    const [min, hour] = parts.map(p => {
      if (p === '*') return null;
      if (p.startsWith('*/')) return parseInt(p.slice(2));
      return parseInt(p);
    });

    // Simple calculation for common patterns
    const next = new Date(now);

    if (min !== null && hour === null) {
      // Every N minutes
      const interval = min;
      next.setMinutes(Math.ceil(next.getMinutes() / interval) * interval);
      next.setSeconds(0);
    } else if (min === null && hour !== null) {
      // Every N hours
      next.setHours(Math.ceil(next.getHours() / hour) * hour);
      next.setMinutes(0);
      next.setSeconds(0);
    } else if (min !== null && hour !== null) {
      // Specific time
      next.setHours(hour);
      next.setMinutes(min);
      next.setSeconds(0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
    } else {
      // Default: next hour
      next.setHours(next.getHours() + 1);
      next.setMinutes(0);
      next.setSeconds(0);
    }

    return next;
  } catch {
    return null;
  }
}

/**
 * Get all cron jobs (system + openclaw)
 */
export async function getCronJobs(): Promise<OperationResult<CronJob[]>> {
  try {
    const jobs: CronJob[] = [];

    // Get system cron jobs
    try {
      const cronDir = '/etc/cron.d';
      const files = await fs.readdir(cronDir);
      
      for (const file of files) {
        if (file.startsWith('.')) continue;
        
        try {
          const content = await fs.readFile(path.join(cronDir, file), 'utf-8');
          const lines = content.split('\n').filter(l => 
            l.trim() && !l.startsWith('#')
          );
          
          for (const line of lines) {
            const parts = line.split(/\s+/);
            if (parts.length >= 6) {
              const schedule = parts.slice(0, 5).join(' ');
              const command = parts.slice(5).join(' ');
              
              jobs.push({
                id: `system-${file}-${jobs.length}`,
                name: file,
                schedule,
                command,
                enabled: true,
                type: 'system',
                nextRun: calculateNextRun(schedule)?.toISOString(),
              });
            }
          }
        } catch {}
      }
    } catch {
      // No access to system cron, that's fine
    }

    // Get OpenClaw cron jobs via CLI
    try {
      const { stdout } = await execAsync('openclaw cron list --json 2>/dev/null || echo "[]"');
      const openclawJobs = JSON.parse(stdout);
      
      for (const job of openclawJobs) {
        jobs.push({
          id: `openclaw-${job.id || job.name}`,
          name: job.name,
          schedule: job.schedule,
          command: job.command || job.task,
          enabled: job.enabled !== false,
          type: 'openclaw',
          lastRun: job.lastRun,
          nextRun: job.nextRun || calculateNextRun(job.schedule)?.toISOString(),
        });
      }
    } catch {
      // OpenClaw CLI not available, that's fine
    }

    return { success: true, data: jobs };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cron jobs',
    };
  }
}

/**
 * Get cron job by ID
 */
export async function getCronJobById(id: string): Promise<OperationResult<CronJob>> {
  try {
    const result = await getCronJobs();
    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const job = result.data.find(j => j.id === id);
    if (!job) {
      return { success: false, error: 'Cron job not found' };
    }

    return { success: true, data: job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cron job',
    };
  }
}

/**
 * Run a cron job immediately
 */
export async function runCronJob(id: string): Promise<OperationResult<CronRun>> {
  try {
    const jobResult = await getCronJobById(id);
    if (!jobResult.success || !jobResult.data) {
      return { success: false, error: 'Cron job not found' };
    }

    const job = jobResult.data;
    const runId = `run-${Date.now()}`;
    const startTime = new Date().toISOString();

    // Create running record
    const run: CronRun = {
      id: runId,
      jobId: id,
      status: 'running',
      startTime,
    };

    // Store run
    if (!cronRuns.has(id)) {
      cronRuns.set(id, []);
    }
    cronRuns.get(id)!.unshift(run);

    try {
      // Execute the command
      const { stdout, stderr } = await execAsync(job.command, {
        timeout: 60000, // 1 minute timeout
      });

      const endTime = new Date();
      run.status = 'success';
      run.endTime = endTime.toISOString();
      run.output = stdout;
      run.duration = endTime.getTime() - new Date(startTime).getTime();

      if (stderr) {
        run.output += `\n[stderr]: ${stderr}`;
      }
    } catch (execError) {
      const endTime = new Date();
      run.status = 'failed';
      run.endTime = endTime.toISOString();
      run.error = execError instanceof Error ? execError.message : 'Execution failed';
      run.duration = endTime.getTime() - new Date(startTime).getTime();
    }

    return { success: true, data: run };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run cron job',
    };
  }
}

/**
 * Get run history for a cron job
 */
export async function getCronRunHistory(
  jobId: string,
  pagination: PaginationParams = {}
): Promise<OperationResult<PaginatedResult<CronRun>>> {
  try {
    const runs = cronRuns.get(jobId) || [];
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const start = (page - 1) * limit;

    return {
      success: true,
      data: {
        items: runs.slice(start, start + limit),
        total: runs.length,
        page,
        limit,
        hasMore: start + limit < runs.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get run history',
    };
  }
}

/**
 * Enable a cron job
 */
export async function enableCronJob(id: string): Promise<OperationResult> {
  try {
    const jobResult = await getCronJobById(id);
    if (!jobResult.success || !jobResult.data) {
      return { success: false, error: 'Cron job not found' };
    }

    if (jobResult.data.type === 'openclaw') {
      await execAsync(`openclaw cron enable ${jobResult.data.name}`);
    } else {
      return { success: false, error: 'System cron jobs cannot be modified' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enable cron job',
    };
  }
}

/**
 * Disable a cron job
 */
export async function disableCronJob(id: string): Promise<OperationResult> {
  try {
    const jobResult = await getCronJobById(id);
    if (!jobResult.success || !jobResult.data) {
      return { success: false, error: 'Cron job not found' };
    }

    if (jobResult.data.type === 'openclaw') {
      await execAsync(`openclaw cron disable ${jobResult.data.name}`);
    } else {
      return { success: false, error: 'System cron jobs cannot be modified' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disable cron job',
    };
  }
}
