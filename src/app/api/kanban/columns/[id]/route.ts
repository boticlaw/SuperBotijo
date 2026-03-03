import { NextRequest, NextResponse } from "next/server";
import { getColumn, updateColumn, deleteColumn, type UpdateColumnInput } from "@/lib/kanban-db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/kanban/columns/[id]
 * Get a single column by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Column ID is required" },
        { status: 400 }
      );
    }

    const column = getColumn(id);

    if (!column) {
      return NextResponse.json(
        { error: "Column not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ column });
  } catch (error) {
    console.error("Failed to get column:", error);
    return NextResponse.json(
      { error: "Failed to get column" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/kanban/columns/[id]
 * Update a column (name, color, limit)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Column ID is required" },
        { status: 400 }
      );
    }

    const body: UpdateColumnInput = await request.json();

    if (body.name !== undefined && typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name must be a string" },
        { status: 400 }
      );
    }

    // Validate color format if provided
    if (body.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json(
        { error: "Color must be a valid hex color (e.g., #3b82f6)" },
        { status: 400 }
      );
    }

    // Validate limit if provided
    if (body.limit !== undefined && body.limit !== null) {
      if (typeof body.limit !== "number" || body.limit < 1 || !Number.isInteger(body.limit)) {
        return NextResponse.json(
          { error: "Limit must be a positive integer or null" },
          { status: 400 }
        );
      }
    }

    const column = updateColumn(id, body);

    if (!column) {
      return NextResponse.json(
        { error: "Column not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ column });
  } catch (error) {
    console.error("Failed to update column:", error);
    return NextResponse.json(
      { error: "Failed to update column" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/kanban/columns/[id]
 * Delete a column (fails if has tasks)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Column ID is required" },
        { status: 400 }
      );
    }

    const deleted = deleteColumn(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Column not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete column";
    console.error("Failed to delete column:", error);

    // Check if error is due to tasks in column
    if (message.includes("Cannot delete column with")) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete column" },
      { status: 500 }
    );
  }
}
