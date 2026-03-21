import { NextRequest, NextResponse } from "next/server";
import {
  createJournalEntry,
  listJournalEntries,
} from "@/lib/kanban-db";
import type { CreateJournalEntryInput } from "@/lib/mission-types";

export const dynamic = "force-dynamic";

/**
 * GET /api/journal
 * List journal entries with optional date range filter
 * Query params:
 *   - startDate: ISO date string (YYYY-MM-DD)
 *   - endDate: ISO date string (YYYY-MM-DD)
 *   - limit: max number of entries (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const entries = listJournalEntries({ startDate, endDate }).slice(0, limit);

    return NextResponse.json({
      entries,
      total: entries.length,
      limit,
    });
  } catch (error) {
    console.error("Failed to list journal entries:", error);
    return NextResponse.json(
      { error: "Failed to list journal entries" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/journal
 * Create a new journal entry
 * Body: { date: string, narrative: string, highlights?: string[] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.date) {
      return NextResponse.json(
        { error: "date is required" },
        { status: 400 }
      );
    }

    if (!body.narrative) {
      return NextResponse.json(
        { error: "narrative is required" },
        { status: 400 }
      );
    }

    // Validate narrative length
    if (body.narrative.length < 10) {
      return NextResponse.json(
        { error: "narrative must be at least 10 characters" },
        { status: 400 }
      );
    }

    if (body.narrative.length > 5000) {
      return NextResponse.json(
        { error: "narrative must be 5000 characters or less" },
        { status: 400 }
      );
    }

    // Validate highlights if provided
    if (body.highlights !== undefined) {
      if (!Array.isArray(body.highlights)) {
        return NextResponse.json(
          { error: "highlights must be an array" },
          { status: 400 }
        );
      }

      if (body.highlights.length > 10) {
        return NextResponse.json(
          { error: "highlights must have at most 10 items" },
          { status: 400 }
        );
      }

      // Validate each highlight is a string
      for (const highlight of body.highlights) {
        if (typeof highlight !== "string") {
          return NextResponse.json(
            { error: "each highlight must be a string" },
            { status: 400 }
          );
        }
      }
    }

    const input: CreateJournalEntryInput = {
      date: body.date,
      narrative: body.narrative,
      highlights: body.highlights || [],
    };

    const entry = createJournalEntry(input);

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    console.error("Failed to create journal entry:", error);
    return NextResponse.json(
      { error: "Failed to create journal entry" },
      { status: 500 }
    );
  }
}
