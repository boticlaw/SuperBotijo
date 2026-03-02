import path from 'path';

/**
 * Centralized path configuration.
 * In production (VPS), these default to /home/daniel/.openclaw paths.
 * For local development, override via environment variables.
 */
export const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/daniel/.openclaw';
export const OPENCLAW_WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(OPENCLAW_DIR, 'workspace');
export const OPENCLAW_CONFIG = path.join(OPENCLAW_DIR, 'openclaw.json');
export const OPENCLAW_MEDIA = path.join(OPENCLAW_DIR, 'media');

export const WORKSPACE_IDENTITY = path.join(OPENCLAW_WORKSPACE, 'IDENTITY.md');
export const WORKSPACE_TOOLS = path.join(OPENCLAW_WORKSPACE, 'TOOLS.md');
export const WORKSPACE_MEMORY = path.join(OPENCLAW_WORKSPACE, 'memory');

export const SYSTEM_SKILLS_PATH = '/usr/lib/node_modules/openclaw/skills';
export const WORKSPACE_SKILLS_PATH = path.join(OPENCLAW_DIR, 'workspace-infra', 'skills');

/** Allowed base paths for media/file serving */
export const ALLOWED_MEDIA_PREFIXES = [
  path.join(OPENCLAW_WORKSPACE, '/'),
  path.join(OPENCLAW_MEDIA, '/'),
];
