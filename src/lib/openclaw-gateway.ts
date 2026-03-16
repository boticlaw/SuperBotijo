import "server-only";

import { createPrivateKey, randomUUID, sign } from "crypto";
import fs from "fs";

import type { ChatGatewayStatus } from "@/lib/openclaw-chat-types";
import { OPENCLAW_DIR } from "@/lib/paths";

interface GatewayConfig {
  url: string | null;
  host: string;
  token: string;
  deviceToken: string;
  password: string;
  port: number;
  device: GatewayDeviceIdentity | null;
}

interface GatewayDeviceIdentity {
  id: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

interface StoredDeviceIdentity {
  deviceId?: string;
  publicKeyPem?: string;
  privateKeyPem?: string;
}

interface StoredDeviceAuth {
  tokens?: {
    operator?: {
      token?: string;
    };
  };
}

interface GatewayResponseFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code?: string; message?: string };
}

interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

type GatewayFrame = GatewayResponseFrame | GatewayEventFrame;

export interface GatewayChatRun {
  runId: string;
  close: () => void;
  onChatEvent: (handler: (payload: unknown) => void) => void;
  waitForCompletion: (timeoutMs: number) => Promise<void>;
}

function readGatewayDeviceIdentity(): GatewayDeviceIdentity | null {
  const devicePath = `${OPENCLAW_DIR}/identity/device.json`;

  try {
    const raw = fs.readFileSync(devicePath, "utf-8");
    const parsed = JSON.parse(raw) as StoredDeviceIdentity;
    const id = parsed.deviceId?.trim() ?? "";
    const publicKeyPem = parsed.publicKeyPem?.trim() ?? "";
    const privateKeyPem = parsed.privateKeyPem?.trim() ?? "";

    if (!id || !publicKeyPem || !privateKeyPem) {
      return null;
    }

    return {
      id,
      publicKeyPem,
      privateKeyPem,
    };
  } catch {
    return null;
  }
}

function readGatewayOperatorDeviceToken(): string {
  const deviceAuthPath = `${OPENCLAW_DIR}/identity/device-auth.json`;

  try {
    const raw = fs.readFileSync(deviceAuthPath, "utf-8");
    const parsed = JSON.parse(raw) as StoredDeviceAuth;
    return parsed.tokens?.operator?.token?.trim() ?? "";
  } catch {
    return "";
  }
}

function readGatewayConfig(): GatewayConfig {
  const configPath = `${OPENCLAW_DIR}/openclaw.json`;
  const fallbackPort = Number.parseInt(process.env.OPENCLAW_GATEWAY_PORT ?? "", 10);
  const envPort = Number.isFinite(fallbackPort) ? fallbackPort : 18789;

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      gateway?: {
        mode?: "local" | "remote";
        port?: number;
        bind?: "auto" | "lan" | "loopback" | "custom" | "tailnet";
        customBindHost?: string;
        remote?: { url?: string };
        auth?: { token?: string; password?: string };
      };
    };

    const deviceToken = readGatewayOperatorDeviceToken();
    const token = process.env.OPENCLAW_GATEWAY_TOKEN ?? parsed.gateway?.auth?.token ?? deviceToken;
    const password = process.env.OPENCLAW_GATEWAY_PASSWORD ?? parsed.gateway?.auth?.password ?? "";
    const mode = parsed.gateway?.mode ?? "local";
    const explicitUrl = process.env.OPENCLAW_GATEWAY_URL ?? (mode === "remote" ? parsed.gateway?.remote?.url : undefined) ?? null;

    const configuredHost = process.env.OPENCLAW_GATEWAY_HOST ?? parsed.gateway?.customBindHost;
    const bindMode = parsed.gateway?.bind;
    const host =
      configuredHost ??
      (bindMode === "tailnet" ? parsed.gateway?.customBindHost ?? "127.0.0.1" : "127.0.0.1");

    return {
      url: explicitUrl,
      host,
      token,
      deviceToken,
      password,
      port: parsed.gateway?.port ?? envPort,
      device: readGatewayDeviceIdentity(),
    };
  } catch {
    const deviceToken = readGatewayOperatorDeviceToken();
    return {
      url: process.env.OPENCLAW_GATEWAY_URL ?? null,
      host: process.env.OPENCLAW_GATEWAY_HOST ?? "127.0.0.1",
      token: process.env.OPENCLAW_GATEWAY_TOKEN ?? deviceToken,
      deviceToken,
      password: process.env.OPENCLAW_GATEWAY_PASSWORD ?? "",
      port: envPort,
      device: readGatewayDeviceIdentity(),
    };
  }
}

function buildConnectParams(config: GatewayConfig, nonce?: string): Record<string, unknown> {
  const auth: { token?: string; deviceToken?: string; password?: string } = {};
  if (config.token.trim()) {
    auth.token = config.token.trim();
  }
  if (config.deviceToken.trim()) {
    auth.deviceToken = config.deviceToken.trim();
  }
  if (config.password.trim()) {
    auth.password = config.password.trim();
  }

  const client = {
    id: "gateway-client",
    version: "1.0.0",
    platform: "node",
    mode: "backend",
    instanceId: "superbotijo-chat",
  } as const;
  const role = "operator";
  const scopes = ["operator.admin"];

  let device: Record<string, unknown> | undefined;
  if (config.device && nonce) {
    const signedAt = Date.now();
    const payload = [
      "v2",
      config.device.id,
      client.id,
      client.mode,
      role,
      scopes.join(","),
      String(signedAt),
      auth.token ?? "",
      nonce,
    ].join("|");

    const signature = sign(null, Buffer.from(payload, "utf-8"), createPrivateKey(config.device.privateKeyPem));
    device = {
      id: config.device.id,
      publicKey: config.device.publicKeyPem,
      signature: signature.toString("base64url"),
      signedAt,
      nonce,
    };
  }

  return {
    minProtocol: 3,
    maxProtocol: 3,
    client,
    role,
    scopes,
    device,
    caps: [],
    auth: Object.keys(auth).length > 0 ? auth : undefined,
    locale: "en-US",
    userAgent: "superbotijo-chat",
  };
}

function toWebSocketUrl(value: string): string {
  if (/^wss?:\/\//i.test(value)) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value.replace(/^http/i, "ws");
  }

  return `ws://${value}`;
}

function getGatewaySocketUrls(config: GatewayConfig): string[] {
  const urls = new Set<string>();
  const push = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }
    urls.add(toWebSocketUrl(normalized));
  };

  if (config.url) {
    push(config.url);
    return Array.from(urls);
  }

  push(`${config.host}:${config.port}`);
  push(`127.0.0.1:${config.port}`);
  push(`localhost:${config.port}`);
  push(`[::1]:${config.port}`);

  return Array.from(urls);
}

async function connectGatewaySession(ws: WebSocket, config: GatewayConfig, timeoutMs: number): Promise<void> {
  const requestId = randomUUID();
  let didSend = false;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Gateway connect timed out"));
    }, timeoutMs);

    const sendConnect = (nonce?: string) => {
      if (didSend) {
        return;
      }

      didSend = true;
      ws.send(
        JSON.stringify({
          type: "req",
          id: requestId,
          method: "connect",
          params: buildConnectParams(config, nonce),
        }),
      );
    };

    const fallbackConnect = config.device
      ? null
      : setTimeout(() => {
          sendConnect();
        }, 150);

    const cleanup = () => {
      clearTimeout(timeout);
      if (fallbackConnect) {
        clearTimeout(fallbackConnect);
      }
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("error", handleError);
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Gateway socket connection error"));
    };

    const handleClose = () => {
      cleanup();
      reject(new Error("Gateway socket closed during connect"));
    };

    const handleMessage = (event: MessageEvent) => {
      const frame = parseFrame(event.data);
      if (!frame) {
        return;
      }

      if (frame.type === "event" && frame.event === "connect.challenge") {
        const challengePayload = frame.payload as { nonce?: unknown } | undefined;
        const nonce = typeof challengePayload?.nonce === "string" ? challengePayload.nonce : undefined;
        sendConnect(nonce);
        return;
      }

      if (frame.type === "res" && frame.id === requestId) {
        cleanup();
        if (frame.ok) {
          resolve();
          return;
        }

        reject(new Error(frame.error?.message ?? "Gateway connect failed"));
      }
    };

    ws.addEventListener("message", handleMessage);
    ws.addEventListener("close", handleClose);
    ws.addEventListener("error", handleError);
  });
}

function parseFrame(rawData: unknown): GatewayFrame | null {
  let text = "";
  if (typeof rawData === "string") {
    text = rawData;
  } else if (rawData instanceof ArrayBuffer) {
    text = Buffer.from(rawData).toString("utf-8");
  } else if (ArrayBuffer.isView(rawData)) {
    text = Buffer.from(rawData.buffer, rawData.byteOffset, rawData.byteLength).toString("utf-8");
  } else {
    text = String(rawData ?? "");
  }

  try {
    const parsed = JSON.parse(text) as GatewayFrame;
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function sendRequest(
  ws: WebSocket,
  method: string,
  params: unknown,
  timeoutMs: number,
): Promise<unknown> {
  const requestId = randomUUID();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Gateway ${method} timed out`));
    }, timeoutMs);

    const handleMessage = (event: MessageEvent) => {
      const frame = parseFrame(event.data);
      if (!frame || frame.type !== "res" || frame.id !== requestId) {
        return;
      }

      ws.removeEventListener("message", handleMessage);
      clearTimeout(timeout);

      if (frame.ok) {
        resolve(frame.payload);
      } else {
        reject(new Error(frame.error?.message ?? `Gateway ${method} failed`));
      }
    };

    ws.addEventListener("message", handleMessage);
    ws.send(
      JSON.stringify({
        type: "req",
        id: requestId,
        method,
        params,
      }),
    );
  });
}

async function openGatewaySocket(timeoutMs = 4_000): Promise<WebSocket> {
  const config = readGatewayConfig();
  const urls = getGatewaySocketUrls(config);
  const errors: string[] = [];

  for (const url of urls) {
    const ws = new WebSocket(url);

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Gateway socket open timeout"));
        }, timeoutMs);

        ws.addEventListener("open", () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.addEventListener("error", () => {
          clearTimeout(timeout);
          reject(new Error("Gateway socket connection error"));
        });
      });

      await connectGatewaySession(ws, config, timeoutMs);
      return ws;
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : "connection failed"}`);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
  }

  throw new Error(errors.length > 0 ? errors.join(" | ") : "Gateway unavailable");
}

export async function checkGatewayStatus(): Promise<ChatGatewayStatus> {
  const start = Date.now();
  let ws: WebSocket | null = null;
  try {
    ws = await openGatewaySocket(3_500);
    await sendRequest(ws, "health", {}, 3_500);
    ws.close();
    return {
      available: true,
      latencyMs: Date.now() - start,
      error: null,
    };
  } catch (error) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    return {
      available: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : "Gateway unavailable",
    };
  }
}

export async function startGatewayChat(params: {
  sessionKey: string;
  message: string;
}): Promise<GatewayChatRun> {
  const ws = await openGatewaySocket(5_000);
  const runPayload = (await sendRequest(
    ws,
    "chat.send",
    {
      sessionKey: params.sessionKey,
      message: params.message,
      idempotencyKey: randomUUID(),
    },
    10_000,
  )) as { runId?: string };

  const runId = runPayload.runId;
  if (!runId) {
    ws.close();
    throw new Error("Gateway did not return runId");
  }

  const subscribers = new Set<(payload: unknown) => void>();
  const listener = (event: MessageEvent) => {
    const frame = parseFrame(event.data);
    if (!frame || frame.type !== "event" || frame.event !== "chat") {
      return;
    }

    const payload = frame.payload as { runId?: string };
    if (payload?.runId !== runId) {
      return;
    }

    for (const subscriber of subscribers) {
      subscriber(frame.payload);
    }
  };

  ws.addEventListener("message", listener);

  return {
    runId,
    close: () => {
      ws.removeEventListener("message", listener);
      ws.close();
    },
    onChatEvent: (handler) => {
      subscribers.add(handler);
    },
    waitForCompletion: async (timeoutMs) => {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Gateway stream timeout"));
        }, timeoutMs);

        const completionHandler = (payload: unknown) => {
          const typedPayload = payload as { state?: string };
          if (
            typedPayload.state === "final" ||
            typedPayload.state === "error" ||
            typedPayload.state === "aborted"
          ) {
            clearTimeout(timeout);
            subscribers.delete(completionHandler);
            resolve();
          }
        };

        subscribers.add(completionHandler);
      });
    },
  };
}
