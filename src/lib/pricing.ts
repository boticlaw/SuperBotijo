import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * OpenClaw Model Pricing
 * Based on OpenRouter and Anthropic pricing as of Feb 2026
 * All prices in USD per million tokens
 */

const PRICING_PATH = join(process.cwd(), "data", "model-pricing.json");

export interface ModelPricing {
  id: string;
  name: string;
  alias?: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  contextWindow: number;
  cacheReadPricePerMillion?: number;
  cacheWritePricePerMillion?: number;
}

export interface PricingOverride {
  id: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheReadPricePerMillion?: number;
  cacheWritePricePerMillion?: number;
}

export interface ModelPricingEntry extends ModelPricing {
  isCustomized: boolean;
  defaults?: Partial<ModelPricing>;
}

export const MODEL_PRICING: ModelPricing[] = [
  // Anthropic models (with prompt caching support)
  {
    id: "anthropic/claude-opus-4-6",
    name: "Opus 4.6",
    alias: "opus",
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    contextWindow: 200000,
    cacheReadPricePerMillion: 1.50,
    cacheWritePricePerMillion: 18.75,
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Sonnet 4.5",
    alias: "sonnet",
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    contextWindow: 200000,
    cacheReadPricePerMillion: 0.30,
    cacheWritePricePerMillion: 3.75,
  },
  {
    id: "anthropic/claude-haiku-3-5",
    name: "Haiku 3.5",
    alias: "haiku",
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
    contextWindow: 200000,
    cacheReadPricePerMillion: 0.08,
    cacheWritePricePerMillion: 1.00,
  },
  // Google Gemini models
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini Flash",
    alias: "gemini-flash",
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    contextWindow: 1000000,
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini Pro",
    alias: "gemini-pro",
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    contextWindow: 2000000,
  },
  // X.AI Grok
  {
    id: "x-ai/grok-4-1-fast",
    name: "Grok 4.1 Fast",
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 10.00,
    contextWindow: 128000,
  },
  // MiniMax
  {
    id: "minimax/minimax-m2.5",
    name: "MiniMax M2.5",
    alias: "minimax",
    inputPricePerMillion: 0.30,
    outputPricePerMillion: 1.10,
    contextWindow: 1000000,
  },
];

/**
 * Read pricing overrides from data/model-pricing.json
 * @returns Array of pricing overrides, or empty array if file doesn't exist or is invalid
 */
export function getPricingOverrides(): PricingOverride[] {
  try {
    if (!existsSync(PRICING_PATH)) {
      return [];
    }
    const content = readFileSync(PRICING_PATH, "utf-8");
    const overrides = JSON.parse(content);
    if (!Array.isArray(overrides)) {
      console.warn("model-pricing.json is not an array, ignoring overrides");
      return [];
    }
    const validOverrides = overrides.filter((o): o is PricingOverride => {
      if (!o || typeof o.id !== "string") return false;
      if (typeof o.inputPricePerMillion !== "number" || o.inputPricePerMillion < 0) return false;
      if (typeof o.outputPricePerMillion !== "number" || o.outputPricePerMillion < 0) return false;
      if (o.cacheReadPricePerMillion !== undefined && (typeof o.cacheReadPricePerMillion !== "number" || o.cacheReadPricePerMillion < 0)) return false;
      if (o.cacheWritePricePerMillion !== undefined && (typeof o.cacheWritePricePerMillion !== "number" || o.cacheWritePricePerMillion < 0)) return false;
      return true;
    });
    return validOverrides;
  } catch (error) {
    console.warn("Failed to read pricing overrides:", error);
    return [];
  }
}

/**
 * Merge default pricing with overrides
 * @returns Array of merged pricing entries with isCustomized flags
 */
export function getMergedPricing(): ModelPricingEntry[] {
  const overrides = getPricingOverrides();
  const overrideMap = new Map<string, PricingOverride>();
  for (const o of overrides) {
    overrideMap.set(o.id, o);
  }

  return MODEL_PRICING.map((defaultPricing): ModelPricingEntry => {
    const override = overrideMap.get(defaultPricing.id);
    if (!override) {
      return { ...defaultPricing, isCustomized: false };
    }
    return {
      ...defaultPricing,
      inputPricePerMillion: override.inputPricePerMillion,
      outputPricePerMillion: override.outputPricePerMillion,
      cacheReadPricePerMillion: override.cacheReadPricePerMillion ?? defaultPricing.cacheReadPricePerMillion,
      cacheWritePricePerMillion: override.cacheWritePricePerMillion ?? defaultPricing.cacheWritePricePerMillion,
      isCustomized: true,
      defaults: {
        inputPricePerMillion: defaultPricing.inputPricePerMillion,
        outputPricePerMillion: defaultPricing.outputPricePerMillion,
        cacheReadPricePerMillion: defaultPricing.cacheReadPricePerMillion,
        cacheWritePricePerMillion: defaultPricing.cacheWritePricePerMillion,
      },
    };
  });
}

/**
 * Calculate cost for a given model and token usage
 */
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number,
  cacheWriteTokens?: number
): number {
  const mergedPricing = getMergedPricing();
  const pricing = mergedPricing.find(
    (p) => p.id === modelId || p.alias === modelId
  );

  if (!pricing) {
    console.warn(`Unknown model: ${modelId}, using default pricing`);
    return (
      (inputTokens / 1_000_000) * 3.0 + (outputTokens / 1_000_000) * 15.0
    );
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;
  const cacheReadCost = cacheReadTokens && pricing.cacheReadPricePerMillion
    ? (cacheReadTokens / 1_000_000) * pricing.cacheReadPricePerMillion
    : 0;
  const cacheWriteCost = cacheWriteTokens && pricing.cacheWritePricePerMillion
    ? (cacheWriteTokens / 1_000_000) * pricing.cacheWritePricePerMillion
    : 0;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

/**
 * Get human-readable model name
 */
export function getModelName(modelId: string): string {
  const mergedPricing = getMergedPricing();
  const pricing = mergedPricing.find(
    (p) => p.id === modelId || p.alias === modelId
  );
  return pricing?.name || modelId;
}

/**
 * Normalize model ID (handle aliases and different formats)
 */
export function normalizeModelId(modelId: string): string {
  // Handle short aliases and OpenClaw format (without provider prefix)
  const aliasMap: Record<string, string> = {
    // Short aliases
    opus: "anthropic/claude-opus-4-6",
    sonnet: "anthropic/claude-sonnet-4-5",
    haiku: "anthropic/claude-haiku-3-5",
    "gemini-flash": "google/gemini-2.5-flash",
    "gemini-pro": "google/gemini-2.5-pro",
    // OpenClaw format (without provider/)
    "claude-opus-4-6": "anthropic/claude-opus-4-6",
    "claude-sonnet-4-5": "anthropic/claude-sonnet-4-5",
    "claude-haiku-3-5": "anthropic/claude-haiku-3-5",
    "gemini-2.5-flash": "google/gemini-2.5-flash",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
    // MiniMax
    minimax: "minimax/minimax-m2.5",
    "minimax-m2.5": "minimax/minimax-m2.5",
  };

  return aliasMap[modelId] || modelId;
}
