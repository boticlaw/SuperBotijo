/**
 * Real-time kanban stream via SSE
 * GET /api/kanban/stream
 * Sends task/column changes as they occur (polling SQLite every 2 seconds)
 */
import { NextRequest } from "next/server";
import { getTasksByColumn, getColumns } from "@/lib/kanban-db";

export const dynamic = "force-dynamic";

interface KanbanState {
  tasksChecksum: string;
  columnsChecksum: string;
}

function computeChecksum(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;
  let lastState: KanbanState | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller might be closed
        }
      };

      // Send initial ping
      send({ type: "connected", ts: new Date().toISOString() });

      const poll = async () => {
        if (closed) return;

        try {
          // Get current state
          const tasksByColumn = getTasksByColumn();
          const columns = getColumns();

          const currentState: KanbanState = {
            tasksChecksum: computeChecksum(tasksByColumn),
            columnsChecksum: computeChecksum(columns),
          };

          if (lastState === null) {
            // First run: send full state
            send({
              type: "initial",
              tasksByColumn,
              columns,
              ts: new Date().toISOString(),
            });
            lastState = currentState;
          } else {
            // Check for changes
            const tasksChanged = currentState.tasksChecksum !== lastState.tasksChecksum;
            const columnsChanged = currentState.columnsChecksum !== lastState.columnsChecksum;

            if (tasksChanged || columnsChanged) {
              send({
                type: "update",
                tasksByColumn,
                columns,
                changes: {
                  tasks: tasksChanged,
                  columns: columnsChanged,
                },
                ts: new Date().toISOString(),
              });
              lastState = currentState;
            }
          }
        } catch {
          // Ignore errors during polling
        }

        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      poll();

      request.signal?.addEventListener("abort", () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
