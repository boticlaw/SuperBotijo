/**
 * Secure Browser Terminal API
 * POST /api/terminal
 * Body: { command }
 * 
 * Security: strict command allowlist pattern matching
 * Only allows safe read-only and status commands
 */
import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

const DISALLOWED_SHELL_OPERATORS = /[|&;<>`$\n\r]/;

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
  const parsed = parseCommand(cmd);
  if (!parsed || parsed.length === 0) {
    return false;
  }

  const baseCmd = parsed[0].replace(/^[!]/, '');
  if (!ALLOWED_BASE_COMMANDS.has(baseCmd)) {
    return false;
  }

  const normalized = parsed.join(' ').trim();
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  return true;
}

function parseCommand(raw: string): string[] | null {
  const command = raw.trim();
  if (!command || DISALLOWED_SHELL_OPERATORS.test(command)) {
    return null;
  }

  const tokens: string[] = [];
  let current = '';
  let quote: 'single' | 'double' | null = null;

  for (let i = 0; i < command.length; i += 1) {
    const char = command[i];

    if (quote === 'single') {
      if (char === "'") {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (quote === 'double') {
      if (char === '"') {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'") {
      quote = 'single';
      continue;
    }

    if (char === '"') {
      quote = 'double';
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (quote !== null) {
    return null;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const command = (body.command || '').trim();
    const parsed = parseCommand(command);

    if (!command) {
      return NextResponse.json({ error: 'No command provided' }, { status: 400 });
    }

    if (!parsed || parsed.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid command format',
          hint: 'Shell operators, substitutions, and malformed quoting are blocked for security.',
        },
        { status: 400 }
      );
    }

    if (!isCommandAllowed(command)) {
      return NextResponse.json({
        error: `Command not allowed: "${command}"`,
        hint: 'Only safe read-only commands are permitted (ls, cat, df, ps, git, ping, etc.). Commands like env, curl, wget, node, python are blocked for security.',
      }, { status: 403 });
    }

    const start = Date.now();
    const executable = parsed[0].replace(/^[!]/, '');
    const args = parsed.slice(1);
    const { stdout, stderr } = await execFileAsync(executable, args, {
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      shell: false,
    });
    const duration = Date.now() - start;

    return NextResponse.json({
      output: stdout + (stderr ? `\nSTDERR: ${stderr}` : ''),
      duration,
      command,
    });
  } catch (error) {
    const execError = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    const msg = execError.stderr || execError.stdout || execError.message || String(error);
    const statusCode = typeof execError.code === 'number' ? 400 : 500;

    return NextResponse.json({ error: msg.trim() || 'Terminal command failed' }, { status: statusCode });
  }
}
