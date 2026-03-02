import { existsSync, mkdirSync, statSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  MODEL_PRICING,
  PricingOverride,
  getMergedPricing,
  getPricingOverrides,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

const PRICING_PATH = join(process.cwd(), "data", "model-pricing.json");

interface ErrorResponse {
  error: string;
  details?: string[];
}

function getFileLastModified(): string | null {
  try {
    if (!existsSync(PRICING_PATH)) {
      return null;
    }
    const stats = statSync(PRICING_PATH);
    return stats.mtime.toISOString();
  } catch {
    return null;
  }
}

function savePricingOverrides(overrides: PricingOverride[]): void {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(PRICING_PATH, JSON.stringify(overrides, null, 2));
}

function validateOverride(override: unknown, knownModelIds: Set<string>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!override || typeof override !== "object") {
    return { valid: false, errors: ["Override must be an object"] };
  }
  
  const o = override as Record<string, unknown>;
  
  if (typeof o.id !== "string" || o.id.trim() === "") {
    errors.push("Model ID is required and must be a non-empty string");
  } else if (!knownModelIds.has(o.id)) {
    errors.push(`Unknown model ID: ${o.id}`);
  }
  
  if (typeof o.inputPricePerMillion !== "number") {
    errors.push("inputPricePerMillion is required and must be a number");
  } else if (o.inputPricePerMillion < 0) {
    errors.push("inputPricePerMillion cannot be negative");
  }
  
  if (typeof o.outputPricePerMillion !== "number") {
    errors.push("outputPricePerMillion is required and must be a number");
  } else if (o.outputPricePerMillion < 0) {
    errors.push("outputPricePerMillion cannot be negative");
  }
  
  if (o.cacheReadPricePerMillion !== undefined) {
    if (typeof o.cacheReadPricePerMillion !== "number") {
      errors.push("cacheReadPricePerMillion must be a number if provided");
    } else if (o.cacheReadPricePerMillion < 0) {
      errors.push("cacheReadPricePerMillion cannot be negative");
    }
  }
  
  if (o.cacheWritePricePerMillion !== undefined) {
    if (typeof o.cacheWritePricePerMillion !== "number") {
      errors.push("cacheWritePricePerMillion must be a number if provided");
    } else if (o.cacheWritePricePerMillion < 0) {
      errors.push("cacheWritePricePerMillion cannot be negative");
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export async function GET() {
  try {
    const models = getMergedPricing();
    const overrides = getPricingOverrides();
    const lastModified = getFileLastModified();
    
    return NextResponse.json({
      models,
      hasCustomizations: overrides.length > 0,
      lastModified,
    });
  } catch (error) {
    console.error("Error fetching pricing data:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to fetch pricing data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { overrides } = body;
    
    if (!Array.isArray(overrides)) {
      return NextResponse.json<ErrorResponse>(
        { error: "Request body must contain an 'overrides' array" },
        { status: 400 }
      );
    }
    
    const knownModelIds = new Set(MODEL_PRICING.map((m) => m.id));
    const validOverrides: PricingOverride[] = [];
    const allErrors: string[] = [];
    
    for (let i = 0; i < overrides.length; i++) {
      const validation = validateOverride(overrides[i], knownModelIds);
      if (!validation.valid) {
        allErrors.push(...validation.errors.map((e) => `Override ${i + 1}: ${e}`));
      } else {
        const o = overrides[i] as PricingOverride;
        validOverrides.push({
          id: o.id,
          inputPricePerMillion: o.inputPricePerMillion,
          outputPricePerMillion: o.outputPricePerMillion,
          cacheReadPricePerMillion: o.cacheReadPricePerMillion,
          cacheWritePricePerMillion: o.cacheWritePricePerMillion,
        });
      }
    }
    
    if (allErrors.length > 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "Validation failed", details: allErrors },
        { status: 400 }
      );
    }
    
    savePricingOverrides(validOverrides);
    
    const models = getMergedPricing();
    const lastModified = getFileLastModified();
    
    return NextResponse.json({
      models,
      hasCustomizations: validOverrides.length > 0,
      lastModified,
      message: `Updated pricing for ${validOverrides.length} model(s)`,
    });
  } catch (error) {
    console.error("Error updating pricing:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to update pricing" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    if (existsSync(PRICING_PATH)) {
      unlinkSync(PRICING_PATH);
    }
    
    const models = getMergedPricing();
    
    return NextResponse.json({
      models,
      hasCustomizations: false,
      lastModified: null,
      message: "All pricing customizations have been cleared",
    });
  } catch (error) {
    console.error("Error clearing pricing overrides:", error);
    return NextResponse.json<ErrorResponse>(
      { error: "Failed to clear pricing overrides" },
      { status: 500 }
    );
  }
}
