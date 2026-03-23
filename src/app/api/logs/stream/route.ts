/**
 * Real-time log streaming via SSE
 * GET /api/logs/stream?service=<name>&backend=<pm2|systemd>
 */
import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { safeExecFile } from "@/lib/safe-exec";

export const dynamic = "force-dynamic";

interface Pm2Process {
  name: string;
}

function discoverAllowedServices(): Set<string> {
  const allowed = new Set<string>();

  try {
    const result = safeExecFile("systemctl", ["list-units", "--type=service", "--state=running", "--no-pager", "-o", "json"], {});
    if (result.status === 0 && result.stdout) {
      const units = JSON.parse(result.stdout) as Array<{ unit: string }>;
      for (const svc of units) {
        allowed.add(svc.unit.replace(".service", ""));
      }
    }
  } catch {
    // Ignore
  }

  try {
    const result = safeExecFile("systemctl", ["list-unit-files", "--type=service", "--no-pager"], {});
    if (result.status === 0 && result.stdout) {
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        const match = line.match(/^(\S+)\.service\s+/);
        if (match) {
          allowed.add(match[1]);
        }
      }
    }
  } catch {
    // Ignore
  }

  try {
    const whichResult = safeExecFile("which", ["pm2"], {});
    if (whichResult.status === 0) {
      const pm2Result = safeExecFile("pm2", ["jlist"], {});
      if (pm2Result.status === 0 && pm2Result.stdout) {
        const pm2List = JSON.parse(pm2Result.stdout) as Pm2Process[];
        for (const proc of pm2List) {
          allowed.add(proc.name);
        }
      }
    }
  } catch {
    // PM2 not available
  }

  return allowed;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service") || "superbotijo";
  const backend = searchParams.get("backend") || "systemd";

  const allowedServices = discoverAllowedServices();
  if (!allowedServices.has(service)) {
    return new Response("Service not found on system", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ line: data, ts: new Date().toISOString() })}\n\n`
            )
          );
        } catch {}
      };

      send(`[stream] Connected to ${service} (${backend})`);

      let cmd: string[];
      if (backend === "pm2") {
        cmd = ["pm2", "logs", service, "--lines", "50", "--nocolor"];
      } else {
        cmd = ["journalctl", "-u", service, "-n", "50", "--no-pager", "-f"];
      }

      const proc = spawn(cmd[0], cmd.slice(1), {
        stdio: ["ignore", "pipe", "pipe"],
      });

      proc.stdout.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          send(line);
        }
      });

      proc.stderr.on("data", (data: Buffer) => {
        const lines = data.toString().split("\n").filter(Boolean);
        for (const line of lines) {
          send(line);
        }
      });

      proc.on("error", (err) => {
        send(`[error] ${err.message}`);
        try {
          controller.close();
        } catch {}
      });

      proc.on("close", () => {
        send("[stream] Process ended");
        try {
          controller.close();
        } catch {}
      });

      request.signal?.addEventListener("abort", () => {
        proc.kill();
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
