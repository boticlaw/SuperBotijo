/**
 * Quick Actions API
 * POST /api/actions  body: { action }
 * Available actions: git-status, restart-gateway, clear-temp, usage-stats, heartbeat
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logActivity } from '@/lib/activities-db';

const execAsync = promisify(exec);

const WORKSPACE = process.env.OPENCLAW_DIR ? `${process.env.OPENCLAW_DIR}/workspace` : '/home/daniel/.openclaw/workspace';

interface ActionResult {
  action: string;
  status: 'success' | 'error';
  output: string;
  duration_ms: number;
  timestamp: string;
}

async function runAction(action: string): Promise<ActionResult> {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  try {
    let output = '';

    switch (action) {
      case 'git-status': {
        // Find all git repos in workspace and get their status
        const { stdout: dirs } = await execAsync(`find "${WORKSPACE}" -maxdepth 2 -name ".git" -type d 2>/dev/null | head -10`);
        const repoPaths = dirs.trim().split('\n').filter(Boolean).map((d) => d.replace('/.git', ''));

        const results: string[] = [];
        for (const repoPath of repoPaths) {
          const name = repoPath.split('/').pop() || repoPath;
          try {
            const { stdout: status } = await execAsync(`cd "${repoPath}" && git status --short && git log --oneline -3 2>&1`);
            results.push(`📁 ${name}:\n${status || '(clean)'}`);
          } catch {
            results.push(`📁 ${name}: (error reading git status)`);
          }
        }
        output = results.length ? results.join('\n\n') : 'No git repos found in workspace';
        break;
      }

      case 'restart-gateway': {
        const { stdout, stderr } = await execAsync('systemctl restart openclaw-gateway 2>&1 || echo "Service not found"');
        output = stdout || stderr || 'Restart command executed';
        // Also check status
        try {
          const { stdout: status } = await execAsync('systemctl is-active openclaw-gateway 2>&1 || echo "unknown"');
          output += `\nStatus: ${status.trim()}`;
        } catch {}
        break;
      }

      case 'clear-temp': {
        const commands = [
          'find /tmp -maxdepth 1 -type f -mtime +1 -delete 2>/dev/null; echo "Cleaned /tmp"',
          `find "${WORKSPACE}" -name "*.tmp" -o -name "*.bak" | head -20 | xargs rm -f 2>/dev/null; echo "Cleaned tmp/bak files"`,
          'find /root/.pm2/logs -name "*.log" -size +50M -exec truncate -s 10M {} \\; 2>/dev/null; echo "Trimmed large PM2 logs"',
        ];
        const results = await Promise.all(commands.map((cmd) => execAsync(cmd).then((r) => r.stdout).catch((e) => e.message)));
        output = results.join('\n');
        break;
      }

      case 'usage-stats': {
        const { stdout: du } = await execAsync(`du -sh "${WORKSPACE}" 2>/dev/null || echo "N/A"`);
        const { stdout: df } = await execAsync('df -h / | tail -1');
        const { stdout: mem } = await execAsync('free -h | head -2');
        const { stdout: cpu } = await execAsync("top -bn1 | grep 'Cpu(s)' | head -1");
        const { stdout: uptime } = await execAsync('uptime -p');
        output = `Workspace: ${du.trim()}\n\nDisk: ${df.trim()}\n\nMemory:\n${mem.trim()}\n\nCPU: ${cpu.trim()}\n\nUptime: ${uptime.trim()}`;
        break;
      }

      case 'heartbeat': {
        // Check all critical services
        const services = ['superbotijo'];
        const pm2services = ['classvault', 'content-vault', 'brain'];
        const results: string[] = [];

        for (const svc of services) {
          const { stdout } = await execAsync(`systemctl is-active ${svc} 2>/dev/null || echo "inactive"`);
          const status = stdout.trim();
          results.push(`${status === 'active' ? '✅' : '❌'} ${svc}: ${status}`);
        }

        try {
          const { stdout: pm2 } = await execAsync('pm2 jlist 2>/dev/null');
          const pm2list = JSON.parse(pm2);
          for (const svc of pm2services) {
            const proc = pm2list.find((p: { name: string }) => p.name === svc);
            const status = proc?.pm2_env?.status || 'not found';
            results.push(`${status === 'online' ? '✅' : '❌'} ${svc} (pm2): ${status}`);
          }
        } catch {
          results.push('⚠️ PM2: could not connect');
        }

        // Ping the main site
        try {
          const { stdout: ping } = await execAsync('curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://superbotijo.cazaustre.dev');
          results.push(`\n🌐 superbotijo.cazaustre.dev: HTTP ${ping.trim()}`);
        } catch {
          results.push('\n🌐 superbotijo.cazaustre.dev: unreachable');
        }

        output = results.join('\n');
        break;
      }

      case 'npm-audit': {
        const { stdout, stderr } = await execAsync(`cd "${WORKSPACE}/superbotijo" && npm audit --json 2>/dev/null | node -e "const d=require('fs').readFileSync('/dev/stdin','utf-8');const j=JSON.parse(d);console.log('Vulnerabilities: '+JSON.stringify(j.metadata?.vulnerabilities||{}))" 2>&1`).catch((e) => ({ stdout: '', stderr: e.message }));
        output = stdout || stderr || 'Audit completed';
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const duration_ms = Date.now() - start;
    logActivity('command', `Quick action: ${action}`, 'success', { duration_ms, metadata: { action } });

    return { action, status: 'success', output, duration_ms, timestamp };
  } catch (err) {
    const duration_ms = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    logActivity('command', `Quick action failed: ${action}`, 'error', { duration_ms, metadata: { action, error: errMsg } });
    return { action, status: 'error', output: errMsg, duration_ms, timestamp };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

    const validActions = ['git-status', 'restart-gateway', 'clear-temp', 'usage-stats', 'heartbeat', 'npm-audit'];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Unknown action. Valid: ${validActions.join(', ')}` }, { status: 400 });
    }

    const result = await runAction(action);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[actions] Error:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
