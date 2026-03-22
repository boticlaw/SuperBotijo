import { existsSync, mkdirSync, statSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  MODEL_PRICING,
  getMergedPricing,
  getPricingOverrides,
  type PricingOverride,
} from "@/lib/pricing";
import { validateBody, UpdatePricingSchema } from "@/lib/api-validation";

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

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter");
    
    const filterByUsed = filter === "used";
    const models = getMergedPricing(filterByUsed);
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
    const validation = validateBody(UpdatePricingSchema, body);
    if (!validation.success) return validation.error;
    const { overrides } = validation.data;
    
    const knownModelIds = new Set(MODEL_PRICING.map((m) => m.id));
    const unknownIds = overrides.filter((o) => !knownModelIds.has(o.id)).map((o) => o.id);
    
    if (unknownIds.length > 0) {
      return NextResponse.json<ErrorResponse>(
        { error: "Unknown model IDs", details: unknownIds },
        { status: 400 }
      );
    }
    
    const validOverrides: PricingOverride[] = overrides.map((o) => ({
      id: o.id,
      inputPricePerMillion: o.inputPricePerMillion,
      outputPricePerMillion: o.outputPricePerMillion,
      cacheReadPricePerMillion: o.cacheReadPricePerMillion,
      cacheWritePricePerMillion: o.cacheWritePricePerMillion,
    }));
    
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
