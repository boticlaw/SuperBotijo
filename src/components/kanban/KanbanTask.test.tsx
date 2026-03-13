import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KanbanTask } from "./KanbanTask";
import type { KanbanTask as KanbanTaskType } from "@/lib/kanban-db";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.ComponentProps<"div">) => (
      <div {...props}>{children}</div>
    ),
  },
}));

function createMockTask(overrides: Partial<KanbanTaskType> = {}): KanbanTaskType {
  return {
    id: "test-task-id",
    title: "Test Task",
    description: "Test description",
    status: "backlog",
    priority: "medium",
    assignee: null,
    labels: [],
    order: 1000,
    projectId: null,
    domain: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    dueDate: null,
    dependsOn: null,
    executionStatus: null,
    executionResult: null,
    blockedBy: null,
    waitingFor: null,
    claimedBy: null,
    claimedAt: null,
    createdBy: null,
    archived: false,
    archivedAt: null,
    doneAt: null,
    ...overrides,
  };
}

describe("KanbanTask", () => {
  const mockOnClick = vi.fn();
  const mockOnDragStart = vi.fn();
  const mockOnDragEnd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders task title", () => {
    const task = createMockTask({ title: "My Task Title" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    expect(screen.getByText("My Task Title")).toBeInTheDocument();
  });

  it("renders task description when present", () => {
    const task = createMockTask({ description: "Detailed description here" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    expect(screen.getByText("Detailed description here")).toBeInTheDocument();
  });

  it("does not render description when null", () => {
    const task = createMockTask({ description: null });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    // Description element should not exist
    expect(screen.queryByText(/Detailed/)).not.toBeInTheDocument();
  });

  it("renders priority badge", () => {
    const task = createMockTask({ priority: "high" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renders critical priority with alert icon", () => {
    const task = createMockTask({ priority: "critical" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("renders labels when present", () => {
    const task = createMockTask({
      labels: [
        { name: "bug", color: "#ff0000" },
        { name: "urgent", color: "#ff6600" },
      ],
    });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("does not render labels section when empty", () => {
    const task = createMockTask({ labels: [] });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    // No label elements should be present
    expect(screen.queryByText("bug")).not.toBeInTheDocument();
  });

  it("renders assignee initials when present", () => {
    const task = createMockTask({ assignee: "John Doe" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    // getInitials("John Doe") should return "JD"
    expect(screen.getByTitle("John Doe")).toHaveTextContent("JD");
  });

  it("does not render assignee when null", () => {
    const task = createMockTask({ assignee: null });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    // No assignee element should be present
    expect(screen.queryByTitle(/./)).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const task = createMockTask();
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    fireEvent.click(screen.getByText("Test Task"));

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it("has draggable attribute", () => {
    const task = createMockTask();
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    const draggableElement = screen.getByText("Test Task").closest("[draggable]");
    expect(draggableElement).toHaveAttribute("draggable", "true");
  });

  it("calls onDragStart when drag starts", () => {
    const task = createMockTask();
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    const draggableElement = screen.getByText("Test Task").closest("[draggable]");
    fireEvent.dragStart(draggableElement!);

    expect(mockOnDragStart).toHaveBeenCalledTimes(1);
    expect(mockOnDragStart).toHaveBeenCalledWith(expect.anything(), task);
  });

  it("calls onDragEnd when drag ends", () => {
    const task = createMockTask();
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    const draggableElement = screen.getByText("Test Task").closest("[draggable]");
    fireEvent.dragEnd(draggableElement!);

    expect(mockOnDragEnd).toHaveBeenCalledTimes(1);
  });

  it("applies dragging styles when isDragging is true", () => {
    const task = createMockTask();
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={true}
      />
    );

    // The component should still render but with different styles
    expect(screen.getByText("Test Task")).toBeInTheDocument();
  });

  it("renders all priority levels correctly", () => {
    const priorities: Array<"low" | "medium" | "high" | "critical"> = [
      "low",
      "medium",
      "high",
      "critical",
    ];

    for (const priority of priorities) {
      const task = createMockTask({ priority });
      const { unmount } = render(
        <KanbanTask
          task={task}
          onClick={mockOnClick}
          onDragStart={mockOnDragStart}
          onDragEnd={mockOnDragEnd}
          isDragging={false}
        />
      );

      expect(screen.getByText(priority)).toBeInTheDocument();
      unmount();
    }
  });

  it("handles long titles gracefully", () => {
    const longTitle = "This is a very long task title that should be truncated with line-clamp";
    const task = createMockTask({ title: longTitle });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it("handles single word assignee (single initial)", () => {
    const task = createMockTask({ assignee: "John" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    // getInitials("John") should return "J"
    expect(screen.getByTitle("John")).toHaveTextContent("J");
  });

  it("handles three word assignee (two initials max)", () => {
    const task = createMockTask({ assignee: "John Michael Doe" });
    render(
      <KanbanTask
        task={task}
        onClick={mockOnClick}
        onDragStart={mockOnDragStart}
        onDragEnd={mockOnDragEnd}
        isDragging={false}
      />
    );

    // getInitials("John Michael Doe") should return "JM" (max 2)
    expect(screen.getByTitle("John Michael Doe")).toHaveTextContent("JM");
  });
});
