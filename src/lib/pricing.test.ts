import { describe, it, expect } from "vitest";
import { calculateCost, getModelName, normalizeModelId } from "./pricing";

describe("calculateCost", () => {
  describe("exact pricing with 1M tokens", () => {
    it("calculates correctly for Opus 4.6 (1M input, 500K output)", () => {
      const cost = calculateCost("anthropic/claude-opus-4-6", 1_000_000, 500_000);
      expect(cost).toBe(15 + 37.5);
    });

    it("calculates correctly for Sonnet 4.5 (1M input, 500K output)", () => {
      const cost = calculateCost("anthropic/claude-sonnet-4-5", 1_000_000, 500_000);
      expect(cost).toBe(3 + 7.5);
    });

    it("calculates correctly for Haiku 3.5 (1M input, 500K output)", () => {
      const cost = calculateCost("anthropic/claude-haiku-3-5", 1_000_000, 500_000);
      expect(cost).toBe(0.8 + 2);
    });

    it("calculates correctly for Gemini Flash (1M input, 500K output)", () => {
      const cost = calculateCost("google/gemini-2.5-flash", 1_000_000, 500_000);
      expect(cost).toBe(0.15 + 0.3);
    });

    it("calculates correctly for Gemini Pro (1M input, 500K output)", () => {
      const cost = calculateCost("google/gemini-2.5-pro", 1_000_000, 500_000);
      expect(cost).toBe(1.25 + 2.5);
    });

    it("calculates correctly for Grok 4.1 Fast (1M input, 500K output)", () => {
      const cost = calculateCost("x-ai/grok-4-1-fast", 1_000_000, 500_000);
      expect(cost).toBe(2 + 5);
    });

    it("calculates correctly for MiniMax M2.5 (1M input, 500K output)", () => {
      const cost = calculateCost("minimax/minimax-m2.5", 1_000_000, 500_000);
      expect(cost).toBe(0.3 + 0.55);
    });
  });

  describe("alias support", () => {
    it("uses alias 'opus' correctly", () => {
      const cost1 = calculateCost("opus", 1000, 1000);
      const cost2 = calculateCost("anthropic/claude-opus-4-6", 1000, 1000);
      expect(cost1).toBe(cost2);
    });

    it("uses alias 'sonnet' correctly", () => {
      const cost1 = calculateCost("sonnet", 1000, 1000);
      const cost2 = calculateCost("anthropic/claude-sonnet-4-5", 1000, 1000);
      expect(cost1).toBe(cost2);
    });

    it("uses alias 'haiku' correctly", () => {
      const cost1 = calculateCost("haiku", 1000, 1000);
      const cost2 = calculateCost("anthropic/claude-haiku-3-5", 1000, 1000);
      expect(cost1).toBe(cost2);
    });
  });

  describe("cache pricing (Anthropic only)", () => {
    it("includes cache read cost for Opus", () => {
      const cost = calculateCost("anthropic/claude-opus-4-6", 1_000_000, 0, 1_000_000, 0);
      expect(cost).toBe(15 + 1.5);
    });

    it("includes cache write cost for Opus", () => {
      const cost = calculateCost("anthropic/claude-opus-4-6", 1_000_000, 0, 0, 1_000_000);
      expect(cost).toBe(15 + 18.75);
    });

    it("includes both cache costs for Sonnet", () => {
      const cost = calculateCost("anthropic/claude-sonnet-4-5", 0, 0, 1_000_000, 1_000_000);
      expect(cost).toBe(0.3 + 3.75);
    });

    it("ignores cache tokens for models without cache pricing", () => {
      const costWithCache = calculateCost("google/gemini-2.5-flash", 1000, 1000, 1_000_000, 1_000_000);
      const costWithoutCache = calculateCost("google/gemini-2.5-flash", 1000, 1000);
      expect(costWithCache).toBe(costWithoutCache);
    });
  });

  describe("edge cases", () => {
    it("handles zero tokens", () => {
      const cost = calculateCost("anthropic/claude-opus-4-6", 0, 0);
      expect(cost).toBe(0);
    });

    it("returns default cost for unknown model (Sonnet pricing)", () => {
      const cost = calculateCost("unknown-model", 1_000_000, 1_000_000);
      expect(cost).toBe(3 + 15);
    });

    it("calculates small token amounts correctly", () => {
      const cost = calculateCost("anthropic/claude-opus-4-6", 1000, 500);
      expect(cost).toBeCloseTo(0.0525, 4);
    });
  });
});

describe("getModelName", () => {
  it("returns name for known model id", () => {
    expect(getModelName("anthropic/claude-opus-4-6")).toBe("Opus 4.6");
  });

  it("returns name for alias", () => {
    expect(getModelName("sonnet")).toBe("Sonnet 4.5");
  });

  it("returns model id for unknown model", () => {
    expect(getModelName("unknown-model")).toBe("unknown-model");
  });
});

describe("normalizeModelId", () => {
  it("normalizes short aliases", () => {
    expect(normalizeModelId("opus")).toBe("anthropic/claude-opus-4-6");
  });

  it("normalizes openclaw format without provider", () => {
    expect(normalizeModelId("claude-sonnet-4-5")).toBe("anthropic/claude-sonnet-4-5");
  });

  it("returns original if not in alias map", () => {
    expect(normalizeModelId("some-random-model")).toBe("some-random-model");
  });
});
