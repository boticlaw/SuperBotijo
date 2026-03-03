import { NextRequest, NextResponse } from "next/server";
import { getColumns, createColumn, type CreateColumnInput } from "@/lib/kanban-db";

export const dynamic = "force-dynamic";

/**
 * GET /api/kanban/columns
 * List all columns ordered by their order field
 */
export async function GET() {
  try {
    const columns = getColumns();
    return NextResponse.json({ columns });
  } catch (error) {
    console.error("Failed to list columns:", error);
    return NextResponse.json(
      { error: "Failed to list columns" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kanban/columns
 * Create a new column
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateColumnInput = await request.json();

    if (!body.id || typeof body.id !== "string") {
      return NextResponse.json(
        { error: "Column ID is required" },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Column name is required" },
        { status: 400 }
      );
    }

    // Validate ID format (alphanumeric, underscores, hyphens)
    if (!/^[a-zA-Z0-9_-]+$/.test(body.id)) {
      return NextResponse.json(
        { error: "Column ID must contain only alphanumeric characters, underscores, and hyphens" },
        { status: 400 }
      );
    }

    // Validate color format if provided
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: "Color must be a valid hex color (e.g., #3b82f6)" },
        { status: 400 }
      );
    }

    // Validate limit if provided
    if (body.limit !== undefined && body.limit !== null) {
      if (typeof body.limit !== "number" || body.limit < 1 || !Number.isInteger(body.limit)) {
        return NextResponse.json(
          { error: "Limit must be a positive integer" },
          { status: 400 }
        );
      }
    }

    const column = createColumn({
      id: body.id,
      name: body.name,
      color: body.color,
      limit: body.limit,
    });

    return NextResponse.json({ column }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create column";
    console.error("Failed to create column:", error);

    // Check for unique constraint violation
    if (message.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "Column with this ID already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create column" },
      { status: 500 }
    );
  }
}
