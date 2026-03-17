/**
 * Model Pricing Constants
 * Pure data - no FS operations, no server-only restriction
 * Used by both server and client code
 * 
 * Note: GLM models (zhipu/glm-*) are read from openclaw.json at runtime.
 * This file contains fallback pricing for models NOT in openclaw.json.
 */

import type { ModelPricing } from "./pricing";

export const MODEL_PRICING_CONSTANTS: ModelPricing[] = [
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
  // GLM models removed - now read from openclaw.json
];
