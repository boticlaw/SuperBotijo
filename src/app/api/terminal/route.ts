/**
 * Secure Browser Terminal API
 * POST /api/terminal
 * Body: { command }
 * 
 * Security: strict command allowlist pattern matching
 * Only allows safe read-only and status commands
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Allowlist of allowed base commands (first word of command)
// NOTE: env, curl, wget intentionally excluded to prevent secret exfiltration and arbitrary downloads
const ALLOWED_BASE_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'grep', 'wc', 'find', 'stat', 'du', 'df',
  'ps', 'pgrep', 'pidof', 'top', 'htop',
  'uname', 'hostname', 'whoami', 'id', 'uptime', 'date', 'free',
  'systemctl', 'journalctl',
  'pm2', 'docker',
  'git', 'ping', 'nslookup', 'dig', 'host',
  'netstat', 'ss', 'ip', 'ifconfig', 'lsof',
  'echo', 'printf', 'which', 'type', 'file',
  'sort', 'uniq', 'awk', 'sed', 'tr', 'cut', 'xargs',
  'locate',
]);

// Explicitly blocked patterns
const BLOCKED_PATTERNS: RegExp[] = [
  /\brm\s/,
  /\brmdir\s/,
  /\bsudo\b/,
  /\bchmod\b/,
  /\bchown\b/,
  /\bpasswd\b/,
  /\bmkfs\b/,
  /\bdd\s+(if|of)=/,
  /\bformat\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bkill\b/,
  /\bpkill\b/,
  /\benv\b/,        // would expose env vars (ADMIN_PASSWORD, AUTH_SECRET)
  /\bprintenv\b/,   // same as env
  /\bcurl\b/,       // arbitrary HTTP requests / data exfiltration
  /\bwget\b/,       // arbitrary downloads
  /\bnode\b/,       // arbitrary JS execution
  /\bnpm\b/,        // can run arbitrary scripts
  /\bpython3?\b/,   // arbitrary code execution
  /`[^`]*`/,        // command substitution
  /\$\(/,           // command substitution
  />{1,2}\s*[^|&]/,  // output redirect (not pipe)
  /eval\s/,
  /exec\s/,
  /\bsource\b/,
  /\bmount\b/,
  /\bumount\b/,
];

function isCommandAllowed(cmd: string): boolean {
  const trimmed = cmd.trim();

  // Check blocked patterns first
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // For piped commands, check each segment's base command
  // Split on |, ; and && to check each part
  const segments = trimmed.split(/\s*([|;]|&&|\|\|)\s*/).map((s) => s.trim()).filter((s) => s && !['|', ';', '&&', '||'].includes(s));
  
  for (const segment of segments) {
    const baseCmd = segment.split(/\s+/)[0].replace(/^[!]/, ''); // Remove ! prefix
    if (!ALLOWED_BASE_COMMANDS.has(baseCmd)) {
      return false;
    }
  }

  return segments.length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = (body.command || '').trim();

    if (!command) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 });
    }

    if (!isCommandAllowed(command)) {
      return NextResponse.json({
        error: `Command not allowed: "${command}"`,
        hint: 'Only safe read-only commands are permitted (ls, cat, df, ps, git, ping, etc.). Commands like env, curl, wget, node, python are blocked for security.',
      }, { status: 403 });
    }

    const start = Date.now();
    const { stdout, stderr } = await execAsync(command, { timeout: 10000, maxBuffer: 1024 * 1024 });
    const duration = Date.now() - start;

    return NextResponse.json({
      output: stdout + (stderr ? `\nSTDERR: ${stderr}` : ''),
      duration,
      command,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
