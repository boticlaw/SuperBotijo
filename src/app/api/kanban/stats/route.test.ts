import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";
import {
  TASK_COMMENT_TYPE,
  clearAllDataForTesting,
  createTask,
  createTaskComment,
  updateTask,
} from "@/lib/kanban-db";

describe("/api/kanban/stats", () => {
  beforeEach(() => {
    clearAllDataForTesting();
  });

  afterEach(() => {
    clearAllDataForTesting();
  });

  it("returns comment quality metrics", async () => {
    const blockedWithComment = createTask({ title: "Blocked with comment", status: "blocked" });
    createTaskComment({
      taskId: blockedWithComment.id,
      authorType: "human",
      authorId: "user",
      body: "Waiting dependency",
      metadata: { commentType: "blocked" },
    });

    createTask({ title: "Blocked without comment", status: "blocked" });

    const handoffWithComment = createTask({
      title: "Handoff with comment",
      createdBy: "memo",
      assignee: "boti",
    });
    createTaskComment({
      taskId: handoffWithComment.id,
      authorType: "human",
      authorId: "user",
      body: "Handoff to boti",
      metadata: { commentType: "handoff" },
    });

    createTask({
      title: "Handoff without comment",
      createdBy: "memo",
      assignee: "leo",
    });

    const transitionsTask = createTask({ title: "Transition task", status: "in_progress" });
    createTaskComment({
      taskId: transitionsTask.id,
      authorType: "agent",
      authorId: "boti",
      body: "Blocked now",
      commentType: TASK_COMMENT_TYPE.STATUS_CHANGE,
      statusFrom: "in_progress",
      statusTo: "blocked",
    });

    await new Promise((resolve) => setTimeout(resolve, 5));

    updateTask(transitionsTask.id, { status: "done" });
    createTaskComment({
      taskId: transitionsTask.id,
      authorType: "agent",
      authorId: "boti",
      body: "Unblocked and done",
      commentType: TASK_COMMENT_TYPE.STATUS_CHANGE,
      statusFrom: "blocked",
      statusTo: "done",
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stats.commentQuality.blockedWithValidCommentPercent).toBe(50);
    expect(data.stats.commentQuality.handoffsWithCommentPercent).toBe(50);
    expect(data.stats.commentQuality.meanTimeBlockedToResolvedMinutes).not.toBeNull();
  });
});
