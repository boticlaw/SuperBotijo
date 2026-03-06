import {
  LayoutDashboard,
  Users,
  Bot,
  Target,
  LayoutGrid,
  Briefcase,
  BookOpen,
  Rocket,
  Brain,
  FolderOpen,
  Timer,
  Activity,
  Calendar,
  Bell,
  BarChart3,
  FileBarChart,
  Beaker,
  SquareTerminal,
  GitFork,
  Server,
  Puzzle,
  Zap,
  Terminal,
  Settings,
  User,
  Plus,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

/**
 * Represents a single command in the Command Palette
 */
export interface Command {
  /** Unique identifier for the command */
  id: string;
  /** Display label shown in the palette */
  label: string;
  /** Optional icon component from lucide-react */
  icon?: LucideIcon;
  /** Navigation href for page commands */
  href?: string;
  /** Action identifier for quick actions (e.g., "refresh", "new-journal") */
  action?: string;
  /** Group category for organization */
  group: CommandGroup;
  /** Optional keywords for fuzzy matching */
  keywords?: string[];
}

/**
 * Available command groups matching Sidebar navigation
 */
export type CommandGroup =
  | "Main"
  | "Mission Control"
  | "Data"
  | "Analytics"
  | "Tools"
  | "System"
  | "Quick Actions";

/**
 * Navigation commands derived from Sidebar navGroups
 * Contains all dashboard pages organized by group
 */
export const NAV_COMMANDS: Command[] = [
  // Main
  {
    id: "nav-dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    group: "Main",
    keywords: ["home", "inicio"],
  },
  {
    id: "nav-agents",
    label: "Agents",
    icon: Users,
    href: "/agents",
    group: "Main",
    keywords: ["agentes", "bots"],
  },
  {
    id: "nav-subagents",
    label: "Sub-Agents",
    icon: Bot,
    href: "/subagents",
    group: "Main",
    keywords: ["subagentes", "workers"],
  },

  // Data
  {
    id: "nav-memory",
    label: "Memory",
    icon: Brain,
    href: "/memory",
    group: "Data",
    keywords: ["memoria", "recall"],
  },
  {
    id: "nav-files",
    label: "Files",
    icon: FolderOpen,
    href: "/files",
    group: "Data",
    keywords: ["archivos", "documentos", "docs"],
  },
  {
    id: "nav-sessions",
    label: "Sessions",
    icon: Timer,
    href: "/sessions",
    group: "Data",
    keywords: ["sesiones", "history", "historial"],
  },

  // Analytics
  {
    id: "nav-analytics",
    label: "Analytics",
    icon: BarChart3,
    href: "/analytics",
    group: "Analytics",
    keywords: ["metricas", "stats", "estadisticas"],
  },
  {
    id: "nav-reports",
    label: "Reports",
    icon: FileBarChart,
    href: "/reports",
    group: "Analytics",
    keywords: ["reportes", "informes"],
  },

  // Tools
  {
    id: "nav-playground",
    label: "Playground",
    icon: Beaker,
    href: "/playground",
    group: "Tools",
    keywords: ["test", "pruebas", "experiment"],
  },
  {
    id: "nav-terminal",
    label: "Terminal",
    icon: SquareTerminal,
    href: "/terminal",
    group: "Tools",
    keywords: ["consola", "cli", "shell"],
  },
  {
    id: "nav-git",
    label: "Git",
    icon: GitFork,
    href: "/git",
    group: "Tools",
    keywords: ["version", "control", "repositorio"],
  },

  // System
  {
    id: "nav-system",
    label: "System",
    icon: Server,
    href: "/system",
    group: "System",
    keywords: ["sistema", "status", "estado"],
  },
  {
    id: "nav-skills",
    label: "Skills",
    icon: Puzzle,
    href: "/skills",
    group: "System",
    keywords: ["habilidades", "plugins", "extensions"],
  },
  {
    id: "nav-cron",
    label: "Cron Jobs",
    icon: Zap,
    href: "/cron",
    group: "System",
    keywords: ["scheduled", "programados", "tasks"],
  },
  {
    id: "nav-logs",
    label: "Logs",
    icon: Terminal,
    href: "/logs",
    group: "System",
    keywords: ["registros", "debug", "console"],
  },
  {
    id: "nav-settings",
    label: "Settings",
    icon: Settings,
    href: "/settings",
    group: "System",
    keywords: ["configuracion", "prefs", "ajustes"],
  },

  // Mission Control (simplified - only Kanban remains valuable)
  {
    id: "nav-kanban",
    label: "Kanban",
    icon: LayoutGrid,
    href: "/kanban",
    group: "Mission Control",
    keywords: ["board", "tablero", "tasks"],
  },
];

/**
 * Quick action commands for common operations
 */
export const QUICK_ACTIONS: Command[] = [
  {
    id: "action-new-session",
    label: "New Session",
    icon: Plus,
    action: "new-session",
    href: "/sessions?new=true",
    group: "Quick Actions",
    keywords: ["nueva", "sesion", "create", "start"],
  },
  {
    id: "action-refresh",
    label: "Refresh Data",
    icon: RefreshCw,
    action: "refresh",
    group: "Quick Actions",
    keywords: ["actualizar", "reload", "recargar"],
  },
];

/**
 * All commands combined (navigation + quick actions)
 */
export const ALL_COMMANDS: Command[] = [...NAV_COMMANDS, ...QUICK_ACTIONS];

/**
 * Get commands grouped by their group property
 */
export function getCommandsByGroup(): Record<CommandGroup, Command[]> {
  const groups: Record<string, Command[]> = {};

  for (const command of ALL_COMMANDS) {
    if (!groups[command.group]) {
      groups[command.group] = [];
    }
    groups[command.group].push(command);
  }

  return groups as Record<CommandGroup, Command[]>;
}
