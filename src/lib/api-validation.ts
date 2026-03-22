import { z } from "zod";
import { NextResponse } from "next/server";

export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; error: NextResponse } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      error: NextResponse.json(
        { error: "Validation error", details: result.error.flatten() },
        { status: 400 }
      ),
    };
  }
  return { success: true, data: result.data };
}

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const KanbanLabelSchema = z.object({
  name: z.string(),
  color: z.string(),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
  assignee: z.string().nullable().optional(),
  labels: z.array(KanbanLabelSchema).optional(),
  projectId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  createdBy: z.string().nullable().optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
  assignee: z.string().nullable().optional(),
  labels: z.array(KanbanLabelSchema).optional(),
  order: z.number().optional(),
  projectId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  claimedBy: z.string().nullable().optional(),
  claimedAt: z.string().nullable().optional(),
  archived: z.boolean().optional(),
  comment: z.unknown().optional(),
  body: z.unknown().optional(),
  content: z.unknown().optional(),
});

export const PricingOverrideSchema = z.object({
  id: z.string().min(1, "Model ID is required"),
  inputPricePerMillion: z.number().min(0, "inputPricePerMillion cannot be negative"),
  outputPricePerMillion: z.number().min(0, "outputPricePerMillion cannot be negative"),
  cacheReadPricePerMillion: z.number().min(0).optional(),
  cacheWritePricePerMillion: z.number().min(0).optional(),
});

export const UpdatePricingSchema = z.object({
  overrides: z.array(PricingOverrideSchema),
});

export const FileWriteSchema = z.object({
  workspace: z.string().optional(),
  path: z.string().min(1, "Path is required"),
  content: z.string(),
});

export const FileDeleteSchema = z.object({
  workspace: z.string().optional(),
  path: z.string().min(1, "Path is required"),
});

export const LoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const CreateAgentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  skills: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  autoStart: z.boolean().optional(),
});

export const CreateCronJobSchema = z.object({
  name: z.string().min(1, "Job name is required"),
  schedule: z.string().optional(),
  every: z.string().optional(),
  at: z.string().optional(),
  timezone: z.string().optional(),
  agentId: z.string().optional(),
  message: z.string().optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
}).refine(
  (data) => data.schedule || data.every || data.at,
  { message: "Schedule (cron), every, or at is required" }
);

export const UpdateCronJobSchema = z.object({
  id: z.string().min(1, "Job ID is required"),
  name: z.string().optional(),
  schedule: z.string().optional(),
  every: z.string().optional(),
  at: z.string().optional(),
  timezone: z.string().optional(),
  agentId: z.string().optional(),
  message: z.string().optional(),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const CreateTaskCommentSchema = z.object({
  taskId: z.string().min(1, "taskId is required"),
  authorType: z.enum(["human", "agent", "system"]).optional(),
  authorId: z.string().nullable().optional(),
  body: z.string().min(1, "body is required").max(5000, "body must be 5000 characters or less"),
  commentType: z.enum(["comment", "status_change"]).optional(),
  statusFrom: z.string().nullable().optional(),
  statusTo: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const MoveTaskSchema = z.object({
  targetColumnId: z.string().min(1, "Target column ID is required"),
  targetOrder: z.number().optional(),
});

export const ClaimTaskSchema = z.object({
  agentName: z.string().min(1, "Agent name is required"),
});
