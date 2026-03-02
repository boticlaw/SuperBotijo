/**
 * Service action API
 * POST /api/system/services
 * Body: { name, backend, action }  action: restart | stop | start | logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec, execSync as execSyncCb } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

const ALLOWED_DOCKER_IDS_PATTERN = /^[a-f0-9]{6,64}$|^[a-zA-Z0-9_-]+$/;

interface ServicesConfig {
  systemd?: string[];
  pm2?: string[];
}

function loadAdditionalServices(): { systemd: string[]; pm2: string[] } {
  const systemd: string[] = [];
  const pm2: string[] = [];
  
  const envSystemd = process.env.SUPERBOTIJO_SYSTEMD_SERVICES;
  if (envSystemd) {
    systemd.push(...envSystemd.split(',').map(s => s.trim()).filter(Boolean));
  }
  
  const envPm2 = process.env.SUPERBOTIJO_PM2_SERVICES;
  if (envPm2) {
    pm2.push(...envPm2.split(',').map(s => s.trim()).filter(Boolean));
  }
  
  const configLocations = [
    join(process.cwd(), 'allowed-services.json'),
    join(__dirname, '..', '..', '..', 'allowed-services.json'),
    '/home/daniel/.openclaw/workspace/superbotijo/allowed-services.json'
  ];
  
  for (const configFile of configLocations) {
    try {
      if (existsSync(configFile)) {
        const config: ServicesConfig = JSON.parse(readFileSync(configFile, 'utf-8'));
        if (config.systemd && Array.isArray(config.systemd)) {
          systemd.push(...config.systemd);
        }
        if (config.pm2 && Array.isArray(config.pm2)) {
          pm2.push(...config.pm2);
        }
        break;
      }
    } catch {
      // Config file invalid, try next location
    }
  }
  
  return { systemd, pm2 };
}

interface SystemdService {
  unit: string;
}

interface Pm2Process {
  name: string;
}

function getAllowedServices(): { systemd: string[]; pm2: string[] } {
  const systemdServices: Set<string> = new Set();
  
  const isAllowedService = (name: string): boolean => {
    return name.includes('openclaw') || name.includes('superbotijo');
  };
  
  try {
    const stdout = execSyncCb(
      'systemctl list-units --type=service --state=running --no-pager -o json 2>/dev/null',
      { encoding: 'utf-8' }
    );
    const services: SystemdService[] = JSON.parse(stdout);
    
    for (const svc of services) {
      const name = svc.unit.replace('.service', '');
      if (isAllowedService(name)) {
        systemdServices.add(name);
      }
    }
  } catch {
    // Ignore errors from running services check
  }
  
  try {
    const stdout = execSyncCb(
      'systemctl list-unit-files --type=service --no-pager 2>/dev/null',
      { encoding: 'utf-8' }
    );
    const lines = stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/^(\S+)\.service\s+/);
      if (match) {
        const name = match[1];
        if (isAllowedService(name)) {
          systemdServices.add(name);
        }
      }
    }
  } catch {
    // Fallback if list-unit-files fails
    systemdServices.add('openclaw-gateway');
    systemdServices.add('superbotijo');
  }
  
  const pm2Services: string[] = [];
  try {
    execSyncCb('which pm2', { encoding: 'utf-8' });
    const stdout = execSyncCb(
      'pm2 jlist 2>/dev/null',
      { encoding: 'utf-8' }
    );
    const pm2List: Pm2Process[] = JSON.parse(stdout);
    for (const proc of pm2List) {
      pm2Services.push(proc.name);
    }
  } catch {
    // PM2 not installed or no processes
  }
  
  const additional = loadAdditionalServices();
  
  return {
    systemd: [...new Set([...systemdServices, ...additional.systemd])],
    pm2: [...new Set([...pm2Services, ...additional.pm2])]
  };
}

async function pm2Action(name: string, action: string): Promise<string> {
  const { pm2: allowedServices } = getAllowedServices();
  
  if (!allowedServices.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist. Allowed: ${allowedServices.join(', ') || 'none'}`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    // Get last 100 lines of PM2 logs
    try {
      const logFile = `/root/.pm2/logs/${name}-out.log`;
      const { stdout } = await execAsync(`tail -100 "${logFile}" 2>/dev/null || echo "No logs available"`);
      const errFile = `/root/.pm2/logs/${name}-error.log`;
      const { stdout: errOut } = await execAsync(`tail -50 "${errFile}" 2>/dev/null || echo ""`).catch(() => ({ stdout: '' }));
      return `=== STDOUT (last 100 lines) ===\n${stdout}\n${errOut ? `\n=== STDERR (last 50 lines) ===\n${errOut}` : ''}`;
    } catch {
      return 'Could not retrieve logs';
    }
  }

  const { stdout, stderr } = await execAsync(`pm2 ${action} "${name}" 2>&1`);
  return stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
}

async function systemdAction(name: string, action: string): Promise<string> {
  const { systemd: allowedServices } = getAllowedServices();
  
  if (!allowedServices.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist. Allowed: ${allowedServices.join(', ') || 'none'}`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`journalctl -u "${name}" -n 100 --no-pager 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`systemctl ${action} "${name}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

async function dockerAction(id: string, action: string): Promise<string> {
  if (!ALLOWED_DOCKER_IDS_PATTERN.test(id)) {
    throw new Error(`Invalid container ID "${id}"`);
  }
  if (!['start', 'stop', 'restart', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`docker logs --tail 100 "${id}" 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`docker ${action} "${id}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, backend, action } = body;

    if (!name || !backend || !action) {
      return NextResponse.json({ error: 'Missing name, backend or action' }, { status: 400 });
    }

    let output = '';

    switch (backend) {
      case 'pm2':
        output = await pm2Action(name, action);
        break;
      case 'systemd':
        output = await systemdAction(name, action);
        break;
      case 'docker':
        output = await dockerAction(name, action);
        break;
      default:
        return NextResponse.json({ error: `Unknown backend "${backend}"` }, { status: 400 });
    }

    return NextResponse.json({ success: true, output, action, name, backend });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[services API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
