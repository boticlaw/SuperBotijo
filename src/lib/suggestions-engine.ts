import fs from "fs";
import path from "path";
import { MODEL_PRICING_CONSTANTS } from "./model-pricing-constants";
import {
  collectSuggestionsData,
  getMemoryStats,
  getFileStats,
  getKanbanStats,
  getAgentStats,
  type MemoryStats,
  type FileStats,
  type KanbanStats,
  type AgentStats,
} from "./suggestions-data";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const SUGGESTIONS_FILE = path.join(DATA_DIR, "suggestions.json");
const DISMISSED_FILE = path.join(DATA_DIR, "dismissed-suggestions.json");

export type SuggestionType = "optimization" | "warning" | "info" | "cost";
export type SuggestionCategory =
  | "model"
  | "cron"
  | "heartbeat"
  | "token"
  | "skill"
  | "error"
  | "general"
  | "memory"
  | "files"
  | "kanban"
  | "agent";

export interface Suggestion {
  id: string;
  type: SuggestionType;
  category: SuggestionCategory;
  // Translation keys for i18n
  titleKey: string;
  descriptionKey: string;
  titleParams?: Record<string, string | number>;
  descriptionParams?: Record<string, string | number>;
  // Fallback text (for backwards compatibility)
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  action?: {
    labelKey?: string;
    label?: string;
    type: "config" | "link" | "manual";
    target?: string;
    value?: string;
  };
  metadata?: Record<string, string | number>;
  createdAt: string;
  dismissedAt?: string;
  appliedAt?: string;
}

export interface UsageData {
  modelUsage: Array<{ model: string; count: number; totalTokens: number; totalCost: number }>;
  recentErrors: Array<{ message: string; count: number; lastSeen: string }>;
  cronHealth: Array<{ name: string; successRate: number; lastRun: string }>;
  skillUsage: Array<{ name: string; lastUsed: string; uses: number }>;
  heartbeatFrequency: number;
  // New fields for enhanced suggestions
  memoryStats?: MemoryStats;
  fileStats?: FileStats;
  kanbanStats?: KanbanStats;
  agentStats?: AgentStats;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSuggestions(): Suggestion[] {
  try {
    ensureDataDir();
    if (!fs.existsSync(SUGGESTIONS_FILE)) {
      return [];
    }
    const data = fs.readFileSync(SUGGESTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveSuggestions(suggestions: Suggestion[]): void {
  ensureDataDir();
  fs.writeFileSync(SUGGESTIONS_FILE, JSON.stringify(suggestions, null, 2));
}

function loadDismissed(): Set<string> {
  try {
    ensureDataDir();
    if (!fs.existsSync(DISMISSED_FILE)) {
      return new Set();
    }
    const data = fs.readFileSync(DISMISSED_FILE, "utf-8");
    return new Set(JSON.parse(data));
  } catch {
    return new Set();
  }
}

function saveDismissed(dismissed: Set<string>): void {
  ensureDataDir();
  fs.writeFileSync(DISMISSED_FILE, JSON.stringify([...dismissed], null, 2));
}

function generateId(category: SuggestionCategory, key: string): string {
  return `${category}-${key}`;
}

function analyzeModelUsage(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const expensiveModels = ["anthropic/claude-opus-4-6", "anthropic/claude-opus-4"];

  for (const usage of data.modelUsage) {
    if (expensiveModels.includes(usage.model) && usage.totalCost > 1) {
      const id = generateId("model", `expensive-${usage.model}`);
      if (dismissed.has(id)) continue;

      const modelName = MODEL_PRICING_CONSTANTS.find((m) => m.id === usage.model)?.name || usage.model;
      suggestions.push({
        id,
        type: "cost",
        category: "model",
        titleKey: "suggestions.model.expensive.title",
        descriptionKey: "suggestions.model.expensive.description",
        titleParams: { modelName, cost: usage.totalCost },
        descriptionParams: { modelName, cost: usage.totalCost },
        title: `Optimizar uso de ${modelName}`,
        description: `Has gastado $${usage.totalCost.toFixed(2)} en este modelo. Considera usar Claude Haiku para tareas simples y Sonnet para tareas complejas.`,
        impact: usage.totalCost > 10 ? "high" : "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver análisis de costes",
          type: "link",
          target: "/costs",
        },
        metadata: { model: usage.model, cost: usage.totalCost, count: usage.count },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

function analyzeCronHealth(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const cron of data.cronHealth) {
    if (cron.successRate < 0.8) {
      const id = generateId("cron", `health-${cron.name}`);
      if (dismissed.has(id)) continue;

      const failureRate = ((1 - cron.successRate) * 100).toFixed(0);
      suggestions.push({
        id,
        type: "warning",
        category: "cron",
        titleKey: "suggestions.cron.lowSuccessRate.title",
        descriptionKey: "suggestions.cron.lowSuccessRate.description",
        titleParams: { cronName: cron.name, failureRate },
        descriptionParams: { cronName: cron.name, failureRate },
        title: `Cron "${cron.name}" tiene baja tasa de éxito`,
        description: `Este cron job tiene ${failureRate}% de fallos. Revisa la configuración y logs para identificar el problema.`,
        impact: "high",
        action: {
          labelKey: "common.viewAll",
          label: "Ver crons",
          type: "link",
          target: "/cron",
        },
        metadata: { cronName: cron.name, successRate: cron.successRate },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

function analyzeSkillUsage(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  for (const skill of data.skillUsage) {
    const lastUsed = new Date(skill.lastUsed).getTime();
    if (lastUsed < thirtyDaysAgo && skill.uses < 5) {
      const id = generateId("skill", `unused-${skill.name}`);
      if (dismissed.has(id)) continue;

      suggestions.push({
        id,
        type: "info",
        category: "skill",
        titleKey: "suggestions.skill.unused.title",
        descriptionKey: "suggestions.skill.unused.description",
        titleParams: { skillName: skill.name, uses: skill.uses },
        descriptionParams: { skillName: skill.name, uses: skill.uses },
        title: `Skill "${skill.name}" no se usa hace 30 días`,
        description: `Esta skill solo se ha usado ${skill.uses} veces. Considera desinstalarla si ya no la necesitas.`,
        impact: "low",
        action: {
          labelKey: "common.viewAll",
          label: "Ver skills",
          type: "link",
          target: "/skills",
        },
        metadata: { skillName: skill.name, uses: skill.uses, lastUsed: skill.lastUsed },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

function analyzeErrors(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const error of data.recentErrors) {
    if (error.count >= 3) {
      const id = generateId("error", `pattern-${error.message.slice(0, 30)}`);
      if (dismissed.has(id)) continue;

      const errorMsg = error.message.slice(0, 100);
      suggestions.push({
        id,
        type: "warning",
        category: "error",
        titleKey: "suggestions.error.pattern.title",
        descriptionKey: "suggestions.error.pattern.description",
        titleParams: { count: error.count },
        descriptionParams: { count: error.count, message: errorMsg },
        title: "Patrón de errores detectado",
        description: `Se han producido ${error.count} errores similares recientemente: "${errorMsg}..."`,
        impact: "high",
        action: {
          labelKey: "common.viewAll",
          label: "Ver logs",
          type: "link",
          target: "/logs",
        },
        metadata: { errorCount: error.count, lastSeen: error.lastSeen },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

function analyzeHeartbeat(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];

  if (data.heartbeatFrequency > 0 && data.heartbeatFrequency < 30000) {
    const id = generateId("heartbeat", "frequency");
    if (dismissed.has(id)) return suggestions;

    const frequencySecs = (data.heartbeatFrequency / 1000).toFixed(0);
    suggestions.push({
      id,
      type: "optimization",
      category: "heartbeat",
      titleKey: "suggestions.heartbeat.frequent.title",
      descriptionKey: "suggestions.heartbeat.frequent.description",
      titleParams: { frequencySecs: Number(frequencySecs) },
      descriptionParams: { frequencySecs: Number(frequencySecs) },
      title: "Heartbeat muy frecuente",
      description: `El heartbeat se ejecuta cada ${frequencySecs}s. Considera aumentar el intervalo para reducir carga.`,
      impact: "low",
      action: {
        labelKey: "common.viewAll",
        label: "Ver configuración",
        type: "link",
        target: "/settings",
      },
      metadata: { frequency: data.heartbeatFrequency },
      createdAt: new Date().toISOString(),
    });
  }

  return suggestions;
}

function analyzeMemoryUsage(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const stats = data.memoryStats;

  if (!stats) return suggestions;

  // Suggestion: Memory is old (> 30 days)
  if (stats.memoryAgeDays !== null && stats.memoryAgeDays > 30) {
    const id = generateId("memory", "old");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "info",
        category: "memory",
        titleKey: "suggestions.memory.old.title",
        descriptionKey: "suggestions.memory.old.description",
        titleParams: { days: stats.memoryAgeDays },
        descriptionParams: { days: stats.memoryAgeDays },
        title: "Memoria sin actualizar",
        description: `La última actualización de memoria fue hace ${stats.memoryAgeDays} días. Los agentes podrían beneficiarse de nueva información contextual.`,
        impact: "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver memoria",
          type: "link",
          target: "/memory",
        },
        metadata: { memoryAgeDays: stats.memoryAgeDays, totalFiles: stats.totalFiles },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: Memory files are too small (agents might be missing context)
  if (stats.totalFiles > 0 && stats.totalSize < 5000) {
    const id = generateId("memory", "small");
    if (!dismissed.has(id)) {
      const sizeKB = (stats.totalSize / 1024).toFixed(1);
      suggestions.push({
        id,
        type: "warning",
        category: "memory",
        titleKey: "suggestions.memory.small.title",
        descriptionKey: "suggestions.memory.small.description",
        titleParams: {},
        descriptionParams: { sizeKB: Number(sizeKB) },
        title: "Memoria muy pequeña",
        description: `Los archivos de memoria solo ocupan ${sizeKB} KB. Los agentes podrían beneficiarse de más contexto.`,
        impact: "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver memoria",
          type: "link",
          target: "/memory",
        },
        metadata: { totalSize: stats.totalSize, totalFiles: stats.totalFiles },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: No memory files at all
  if (stats.totalFiles === 0) {
    const id = generateId("memory", "none");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "info",
        category: "memory",
        titleKey: "suggestions.memory.none.title",
        descriptionKey: "suggestions.memory.none.description",
        titleParams: {},
        descriptionParams: {},
        title: "Sin memoria configurada",
        description: "No hay archivos de memoria en el workspace. Los agentes trabajan sin contexto persistente entre sesiones.",
        impact: "high",
        action: {
          labelKey: "suggestions.memory.none.actionLabel",
          label: "Crear memoria",
          type: "link",
          target: "/memory",
        },
        metadata: { totalFiles: 0 },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

function analyzeFiles(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const stats = data.fileStats;

  if (!stats) return suggestions;

  // Suggestion: Large workspace with many files
  if (stats.totalFiles > 1000) {
    const id = generateId("files", "large");
    if (!dismissed.has(id)) {
      const sizeMB = (stats.totalSize / (1024 * 1024)).toFixed(1);
      suggestions.push({
        id,
        type: "info",
        category: "files",
        titleKey: "suggestions.files.large.title",
        descriptionKey: "suggestions.files.large.description",
        titleParams: { fileCount: stats.totalFiles, sizeMB: Number(sizeMB) },
        descriptionParams: { fileCount: stats.totalFiles, sizeMB: Number(sizeMB) },
        title: "Workspace grande",
        description: `El workspace tiene ${stats.totalFiles} archivos (${sizeMB} MB). Considera archivar proyectos antiguos.`,
        impact: "low",
        action: {
          labelKey: "common.viewAll",
          label: "Explorar archivos",
          type: "link",
          target: "/files",
        },
        metadata: { totalFiles: stats.totalFiles, totalSize: stats.totalSize },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: No recent file activity
  if (stats.lastModified) {
    const lastMod = new Date(stats.lastModified);
    const daysSince = Math.floor((Date.now() - lastMod.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince > 14 && stats.totalFiles > 0) {
      const id = generateId("files", "inactive");
      if (!dismissed.has(id)) {
        suggestions.push({
          id,
          type: "info",
          category: "files",
          titleKey: "suggestions.files.inactive.title",
          descriptionKey: "suggestions.files.inactive.description",
          titleParams: {},
          descriptionParams: { days: daysSince },
          title: "Workspace inactivo",
          description: `No hay actividad de archivos desde hace ${daysSince} días. Los agentes podrían no estar funcionando correctamente.`,
          impact: "medium",
          action: {
            labelKey: "common.viewAll",
            label: "Ver archivos",
            type: "link",
            target: "/files",
          },
          metadata: { daysSinceLastModified: daysSince, totalFiles: stats.totalFiles },
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return suggestions;
}

function analyzeKanban(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const stats = data.kanbanStats;

  if (!stats) return suggestions;

  // Suggestion: Overdue tasks
  if (stats.overdueTasks > 0) {
    const id = generateId("kanban", "overdue");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "warning",
        category: "kanban",
        titleKey: "suggestions.kanban.overdue.title",
        descriptionKey: "suggestions.kanban.overdue.description",
        titleParams: { count: stats.overdueTasks },
        descriptionParams: { count: stats.overdueTasks },
        title: "Tareas vencidas",
        description: `Hay ${stats.overdueTasks} tareas con fecha de vencimiento vencida. Revisa el tablero Kanban para tomar acción.`,
        impact: "high",
        action: {
          labelKey: "common.viewAll",
          label: "Ver Kanban",
          type: "link",
          target: "/kanban",
        },
        metadata: { overdueTasks: stats.overdueTasks, totalTasks: stats.totalTasks },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: Unassigned tasks
  if (stats.unassignedTasks > 5) {
    const id = generateId("kanban", "unassigned");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "info",
        category: "kanban",
        titleKey: "suggestions.kanban.unassigned.title",
        descriptionKey: "suggestions.kanban.unassigned.description",
        titleParams: { count: stats.unassignedTasks },
        descriptionParams: { count: stats.unassignedTasks },
        title: "Muchas tareas sin asignar",
        description: `Hay ${stats.unassignedTasks} tareas sin asignar. Los agentes podrían procesarlas automáticamente.`,
        impact: "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver Kanban",
          type: "link",
          target: "/kanban",
        },
        metadata: { unassignedTasks: stats.unassignedTasks },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: Many tasks in progress but few done
  const inProgress = stats.tasksByStatus["in_progress"] || 0;
  const done = stats.tasksByStatus["done"] || stats.tasksByStatus["completed"] || 0;

  if (inProgress > 10 && done < inProgress / 3) {
    const id = generateId("kanban", "bottleneck");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "warning",
        category: "kanban",
        titleKey: "suggestions.kanban.bottleneck.title",
        descriptionKey: "suggestions.kanban.bottleneck.description",
        titleParams: { inProgress, done },
        descriptionParams: { inProgress, done },
        title: "Cuello de botella en tareas",
        description: `Hay ${inProgress} tareas en progreso pero solo ${done} completadas. Los agentes podrían estar bloqueados o necesitar soporte.`,
        impact: "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver Kanban",
          type: "link",
          target: "/kanban",
        },
        metadata: { inProgress, done },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

function analyzeAgents(data: UsageData, dismissed: Set<string>): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const stats = data.agentStats;

  if (!stats) return suggestions;

  // Suggestion: Agents without identity
  if (stats.agentsWithoutIdentity > 0) {
    const id = generateId("agent", "no-identity");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "info",
        category: "agent",
        titleKey: "suggestions.agent.noIdentity.title",
        descriptionKey: "suggestions.agent.noIdentity.description",
        titleParams: { count: stats.agentsWithoutIdentity, total: stats.totalAgents },
        descriptionParams: { count: stats.agentsWithoutIdentity, total: stats.totalAgents },
        title: "Agentes sin identidad",
        description: `${stats.agentsWithoutIdentity} de ${stats.totalAgents} agentes no tienen archivo IDENTITY.md. Define su rol y personalidad para mejorar la comunicación.`,
        impact: "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver agentes",
          type: "link",
          target: "/agents",
        },
        metadata: {
          totalAgents: stats.totalAgents,
          agentsWithoutIdentity: stats.agentsWithoutIdentity,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: No agents configured
  if (stats.totalAgents === 0) {
    const id = generateId("agent", "none");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "info",
        category: "agent",
        titleKey: "suggestions.agent.none.title",
        descriptionKey: "suggestions.agent.none.description",
        titleParams: {},
        descriptionParams: {},
        title: "Sin agentes configurados",
        description: "No hay agentes configurados en openclaw.json. Añade agentes para automatizar tareas.",
        impact: "high",
        action: {
          labelKey: "suggestions.agent.none.actionLabel",
          label: "Configurar agentes",
          type: "link",
          target: "/settings",
        },
        metadata: { totalAgents: 0 },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Suggestion: Agents without heartbeat (not polling for tasks)
  const agentsWithoutHeartbeat = stats.totalAgents - stats.agentsWithHeartbeat;
  if (agentsWithoutHeartbeat > 0 && stats.totalAgents > 1) {
    const id = generateId("agent", "no-heartbeat");
    if (!dismissed.has(id)) {
      suggestions.push({
        id,
        type: "info",
        category: "agent",
        titleKey: "suggestions.agent.noHeartbeat.title",
        descriptionKey: "suggestions.agent.noHeartbeat.description",
        titleParams: { count: agentsWithoutHeartbeat },
        descriptionParams: { count: agentsWithoutHeartbeat },
        title: "Agentes sin heartbeat",
        description: `${agentsWithoutHeartbeat} agentes no tienen configurado heartbeat. No podrán recibir tareas automáticamente desde el Kanban.`,
        impact: "medium",
        action: {
          labelKey: "common.viewAll",
          label: "Ver configuración",
          type: "link",
          target: "/settings",
        },
        metadata: {
          agentsWithHeartbeat: stats.agentsWithHeartbeat,
          agentsWithoutHeartbeat,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return suggestions;
}

export function generateSuggestions(data?: Partial<UsageData>): Suggestion[] {
  const dismissed = loadDismissed();
  const existing = loadSuggestions();
  const existingIds = new Set(existing.map((s) => s.id));

  // Collect full data if not provided
  let fullData: UsageData;

  if (data) {
    // Use provided data with fallbacks for new stats
    fullData = {
      modelUsage: data.modelUsage || [],
      recentErrors: data.recentErrors || [],
      cronHealth: data.cronHealth || [],
      skillUsage: data.skillUsage || [],
      heartbeatFrequency: data.heartbeatFrequency || 60000,
      memoryStats: data.memoryStats || getMemoryStats(),
      fileStats: data.fileStats || getFileStats(),
      kanbanStats: data.kanbanStats || getKanbanStats(),
      agentStats: data.agentStats || getAgentStats(),
    };
  } else {
    // Collect all data from OpenClaw
    const collected = collectSuggestionsData();
    fullData = {
      modelUsage: [],
      recentErrors: collected.recentErrors,
      cronHealth: [],
      skillUsage: [],
      heartbeatFrequency: collected.heartbeatFrequency,
      memoryStats: collected.memoryStats,
      fileStats: collected.fileStats,
      kanbanStats: collected.kanbanStats,
      agentStats: collected.agentStats,
    };
  }

  const newSuggestions: Suggestion[] = [
    ...analyzeModelUsage(fullData, dismissed),
    ...analyzeCronHealth(fullData, dismissed),
    ...analyzeSkillUsage(fullData, dismissed),
    ...analyzeErrors(fullData, dismissed),
    ...analyzeHeartbeat(fullData, dismissed),
    ...analyzeMemoryUsage(fullData, dismissed),
    ...analyzeFiles(fullData, dismissed),
    ...analyzeKanban(fullData, dismissed),
    ...analyzeAgents(fullData, dismissed),
  ].filter((s) => !existingIds.has(s.id) && !dismissed.has(s.id));

  if (newSuggestions.length > 0) {
    const allSuggestions = [...newSuggestions, ...existing].slice(0, 20);
    saveSuggestions(allSuggestions);
    return allSuggestions.filter((s) => !s.dismissedAt && !s.appliedAt);
  }

  return existing.filter((s) => !s.dismissedAt && !s.appliedAt);
}

export function getSuggestions(): Suggestion[] {
  const suggestions = loadSuggestions();
  return suggestions.filter((s) => !s.dismissedAt && !s.appliedAt);
}

export function dismissSuggestion(id: string): boolean {
  const suggestions = loadSuggestions();
  const suggestion = suggestions.find((s) => s.id === id);
  if (!suggestion) return false;

  suggestion.dismissedAt = new Date().toISOString();
  saveSuggestions(suggestions);

  const dismissed = loadDismissed();
  dismissed.add(id);
  saveDismissed(dismissed);

  return true;
}

export function applySuggestion(id: string): boolean {
  const suggestions = loadSuggestions();
  const suggestion = suggestions.find((s) => s.id === id);
  if (!suggestion) return false;

  suggestion.appliedAt = new Date().toISOString();
  saveSuggestions(suggestions);

  return true;
}

export function getSuggestionById(id: string): Suggestion | null {
  const suggestions = loadSuggestions();
  return suggestions.find((s) => s.id === id) || null;
}
