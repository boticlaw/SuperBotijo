/**
 * Mission Control Types
 * Core type definitions for the Mission Control Layer
 */

// ============================================================================
// Status Constants
// ============================================================================

export const PROJECT_STATUS = {
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
  ARCHIVED: "archived",
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// ============================================================================
// Core Domain Types
// ============================================================================

/**
 * Mission statement that defines the agent's purpose and guiding principles
 */
export interface Mission {
  /** The core mission statement */
  statement: string;
  /** Strategic goals derived from the mission */
  goals: string[];
  /** Core values that guide decision-making */
  values: string[];
  /** When the mission was last updated */
  lastUpdated: Date;
}

/**
 * Milestone representing a project checkpoint
 */
export interface Milestone {
  /** Milestone title */
  title: string;
  /** Whether the milestone has been completed */
  completed: boolean;
  /** Optional target or completion date */
  date?: string;
}

/**
 * Project tracked within Mission Control
 */
export interface Project {
  /** Unique project identifier */
  id: string;
  /** Project name */
  name: string;
  /** Project description */
  description: string | null;
  /** How this project aligns with the mission */
  missionAlignment: string | null;
  /** Current project status */
  status: ProjectStatus;
  /** Project milestones */
  milestones: Milestone[];
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Agent identity defining personality and role
 */
export interface AgentIdentity {
  /** Agent identifier (from OpenClaw config) */
  id: string;
  /** Display name */
  name: string;
  /** Agent's role/responsibility */
  role: string;
  /** Personality traits and characteristics */
  personality: string | null;
  /** Avatar URL or emoji */
  avatar: string | null;
  /** Agent's personal mission statement */
  mission: string | null;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Operations journal entry for daily narratives
 */
export interface OperationsJournalEntry {
  /** Unique entry identifier */
  id: string;
  /** Date of the entry (YYYY-MM-DD) */
  date: string;
  /** Narrative description of the day's operations */
  narrative: string;
  /** Key highlights and achievements */
  highlights: string[];
  /** Creation timestamp */
  createdAt: string;
}

// ============================================================================
// Input Types for CRUD Operations
// ============================================================================

/**
 * Input for creating a new project
 */
export interface CreateProjectInput {
  name: string;
  description?: string | null;
  missionAlignment?: string | null;
  status?: ProjectStatus;
  milestones?: Milestone[];
}

/**
 * Input for updating an existing project
 */
export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  missionAlignment?: string | null;
  status?: ProjectStatus;
  milestones?: Milestone[];
}

/**
 * Input for creating an agent identity
 */
export interface CreateAgentIdentityInput {
  id: string;
  name: string;
  role: string;
  personality?: string | null;
  avatar?: string | null;
  mission?: string | null;
}

/**
 * Input for updating an agent identity
 */
export interface UpdateAgentIdentityInput {
  name?: string;
  role?: string;
  personality?: string | null;
  avatar?: string | null;
  mission?: string | null;
}

/**
 * Input for creating a journal entry
 */
export interface CreateJournalEntryInput {
  date: string;
  narrative: string;
  highlights?: string[];
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filters for listing projects
 */
export interface ListProjectsFilters {
  status?: ProjectStatus;
}

/**
 * Filters for listing journal entries
 */
export interface ListJournalEntriesFilters {
  startDate?: string;
  endDate?: string;
}

// ============================================================================
// Mission File Types
// ============================================================================

/**
 * Mission data as stored in mission.json
 */
export interface MissionFile {
  statement: string;
  goals: string[];
  values: string[];
  lastUpdated: string;
}
