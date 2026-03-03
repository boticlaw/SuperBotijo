import { NextRequest, NextResponse } from "next/server";
import { getDefaultMission, getMission, saveMission, deleteMission } from "@/lib/mission-storage";
import type { Mission } from "@/lib/mission-types";

export const dynamic = "force-dynamic";

// Validation constants
const MAX_STATEMENT_LENGTH = 1000;
const MAX_GOALS_COUNT = 20;
const MAX_VALUES_COUNT = 10;

/**
 * GET /api/mission
 * Returns the current mission or default if not configured
 */
export async function GET() {
  try {
    const mission = getMission();
    
    if (!mission) {
      return NextResponse.json({ mission: getDefaultMission() });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error("Failed to get mission:", error);
    return NextResponse.json(
      { error: "Failed to get mission" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/mission
 * Update the mission statement, goals, and values
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate statement
    if (body.statement !== undefined) {
      if (typeof body.statement !== "string") {
        return NextResponse.json(
          { error: "Statement must be a string" },
          { status: 400 }
        );
      }
      if (body.statement.length > MAX_STATEMENT_LENGTH) {
        return NextResponse.json(
          { error: `Statement must be ${MAX_STATEMENT_LENGTH} characters or less` },
          { status: 400 }
        );
      }
    }

    // Validate goals
    if (body.goals !== undefined) {
      if (!Array.isArray(body.goals)) {
        return NextResponse.json(
          { error: "Goals must be an array" },
          { status: 400 }
        );
      }
      if (body.goals.length > MAX_GOALS_COUNT) {
        return NextResponse.json(
          { error: `Maximum ${MAX_GOALS_COUNT} goals allowed` },
          { status: 400 }
        );
      }
      // Validate each goal is a string
      for (const goal of body.goals) {
        if (typeof goal !== "string") {
          return NextResponse.json(
            { error: "Each goal must be a string" },
            { status: 400 }
          );
        }
      }
    }

    // Validate values
    if (body.values !== undefined) {
      if (!Array.isArray(body.values)) {
        return NextResponse.json(
          { error: "Values must be an array" },
          { status: 400 }
        );
      }
      if (body.values.length > MAX_VALUES_COUNT) {
        return NextResponse.json(
          { error: `Maximum ${MAX_VALUES_COUNT} values allowed` },
          { status: 400 }
        );
      }
      // Validate each value is a string
      for (const value of body.values) {
        if (typeof value !== "string") {
          return NextResponse.json(
            { error: "Each value must be a string" },
            { status: 400 }
          );
        }
      }
    }

    // Get existing mission or default, then merge with updates
    const existingMission = getMission() ?? getDefaultMission();
    
    const updatedMission: Mission = {
      statement: body.statement ?? existingMission.statement,
      goals: body.goals ?? existingMission.goals,
      values: body.values ?? existingMission.values,
      lastUpdated: new Date(),
    };

    saveMission(updatedMission);

    return NextResponse.json({ mission: updatedMission });
  } catch (error) {
    console.error("Failed to update mission:", error);
    return NextResponse.json(
      { error: "Failed to update mission" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/mission
 * Reset the mission to default (delete the mission file)
 */
export async function DELETE() {
  try {
    const wasDeleted = deleteMission();
    
    return NextResponse.json({ 
      success: true,
      reset: wasDeleted,
      mission: getDefaultMission(),
    });
  } catch (error) {
    console.error("Failed to delete mission:", error);
    return NextResponse.json(
      { error: "Failed to reset mission" },
      { status: 500 }
    );
  }
}
