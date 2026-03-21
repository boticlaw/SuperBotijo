import { execFileSync, spawnSync } from "child_process";

const SAFE_ID_PATTERN = /^[a-zA-Z0-9_\-./]+$/;
const SAFE_SLUG_PATTERN = /^[a-zA-Z0-9_\-]+$/;
const SAFE_VERSION_PATTERN = /^[a-zA-Z0-9_\-./]+$/;

export function isValidId(id: string): boolean {
  if (!id || id.length === 0 || id.length > 255) return false;
  if (id.includes("..") || id.includes("\0")) return false;
  return SAFE_ID_PATTERN.test(id);
}

export function isValidSlug(slug: string): boolean {
  if (!slug || slug.length === 0 || slug.length > 128) return false;
  return SAFE_SLUG_PATTERN.test(slug);
}

export function isValidVersion(version: string): boolean {
  if (!version || version.length === 0 || version.length > 64) return false;
  return SAFE_VERSION_PATTERN.test(version);
}

export interface SafeExecOptions {
  timeout?: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

export interface SafeExecResult {
  stdout: string;
  stderr: string;
  status: number | null;
  error?: Error;
}

export function safeExecFile(
  command: string,
  args: string[],
  options: SafeExecOptions = {}
): SafeExecResult {
  const { timeout = 30000, cwd, env } = options;

  try {
    const stdout = execFileSync(command, args, {
      timeout,
      cwd,
      env: env || process.env,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      stdout: stdout.trim(),
      stderr: "",
      status: 0,
    };
  } catch (error) {
    const execError = error as Error & {
      stdout?: string;
      stderr?: string;
      status?: number;
    };

    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || execError.message,
      status: execError.status ?? 1,
      error: execError,
    };
  }
}

export function safeSpawn(
  command: string,
  args: string[],
  options: SafeExecOptions = {}
): SafeExecResult {
  const { timeout = 30000, cwd, env } = options;

  try {
    const result = spawnSync(command, args, {
      timeout,
      cwd,
      env: env || process.env,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      status: result.status,
      error: result.error,
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: (error as Error).message,
      status: 1,
      error: error as Error,
    };
  }
}

export function validatePath(path: string, basePath: string): boolean {
  if (!path || path.includes("\0")) return false;
  if (!path.startsWith(basePath)) return false;
  if (path.includes("..")) return false;
  return true;
}

export const ALLOWED_CRON_ACTIONS = ["status", "enable", "disable", "run", "rm", "add", "edit", "list", "runs"] as const;
export type CronAction = (typeof ALLOWED_CRON_ACTIONS)[number];

export function isValidCronAction(action: string): action is CronAction {
  return ALLOWED_CRON_ACTIONS.includes(action as CronAction);
}

export const ALLOWED_GIT_ACTIONS = ["status", "pull", "log", "diff"] as const;
export type GitAction = (typeof ALLOWED_GIT_ACTIONS)[number];

export function isValidGitAction(action: string): action is GitAction {
  return ALLOWED_GIT_ACTIONS.includes(action as GitAction);
}
