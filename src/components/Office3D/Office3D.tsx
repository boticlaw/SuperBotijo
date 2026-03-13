'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment, Box } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Suspense, useState, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import { type AgentState, type AgentStatus, type AvatarAccessories } from "./agentsConfig";
import { fetchOfficeAgents, fetchAgentStatuses, getDefaultAccessories } from "@/lib/office-agents";
import AgentDesk from "./AgentDesk";
import Floor from './Floor';
import Walls from './Walls';
import Ceiling from './Ceiling';
import Lights from './Lights';
import AgentPanel from './AgentPanel';
import FileCabinet from './FileCabinet';
import Whiteboard from './Whiteboard';
import CoffeeMachine from './CoffeeMachine';
import PlantPot from './PlantPot';
import Bookshelf from './Bookshelf';
import WallClock from './WallClock';
import Window from './Window';
import FirstPersonControls from './FirstPersonControls';
import { AgentConnection } from './AgentConnection';
import { MemoryModal } from './MemoryModal';
import { RoadmapModal } from './RoadmapModal';
import { EnergyModal } from './EnergyModal';
import WalkingAvatar from './WalkingAvatar';
import { CollabTable } from './CollabTable';
import { LoungeChair } from './LoungeChair';

interface Visitor {
  id: string;
  parentId: string;
  subagentId: string;
  name: string;
  task: string;
  model: string;
  tokens: number;
  status: 'active' | 'idle' | 'offline';
  ageMs: number;
}

interface AgentApiResponse {
  agents: AgentApiItem[];
}

interface AgentApiItem {
  id: string;
  model?: string;
  tokensUsed?: number;
  sessionCount?: number;
  mood?: {
    mood: string;
    emoji: string;
    streak: number;
    energyLevel: number;
  };
  allowAgents?: string[];
  allowAgentsDetails?: AllowedSubagent[];
}

interface AllowedSubagent {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface ConfiguredSubagent {
  id: string;
  parentId: string;
  subagentId: string;
  name: string;
  emoji: string;
  color: string;
}

interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number];
  deskRotation?: [number, number, number];
  tableId?: string;
  color: string;
  role: string;
  department?: string;
  accessories?: AvatarAccessories;
  parentId?: string;
  currentTask?: string;
}

interface PlantDecoration {
  position: [number, number, number];
  size: "small" | "medium" | "large";
  type: "bush" | "tree" | "succulent";
  radius: number;
}

interface WalkwayLane {
  id: string;
  position: [number, number, number];
  size: [number, number];
  rotationY?: number;
  color: string;
  emissive?: string;
}

const PLANT_DECORATIONS: PlantDecoration[] = [
  // Entrada: árboles en esquinas para marcar recepción
  { position: [-8.8, 0, 7.2], size: "large", type: "tree", radius: 0.65 },
  { position: [8.8, 0, 7.2], size: "large", type: "tree", radius: 0.65 },

  // Esquinas de servicio: un poco de verde en coffee/archive corners
  { position: [-7.2, 0, -3.9], size: "medium", type: "bush", radius: 0.52 },
  { position: [7.2, 0, -3.9], size: "medium", type: "bush", radius: 0.52 },

  // Laterales de pizarra: plantas chicas de apoyo visual
  { position: [-1.9, 0, -7.0], size: "small", type: "succulent", radius: 0.36 },
  { position: [1.9, 0, -7.0], size: "small", type: "succulent", radius: 0.36 },
];

const FILE_CABINET_POSITION: [number, number, number] = [-8.6, 0, -5.4];
const WHITEBOARD_POSITION: [number, number, number] = [0, 0, -8];
const COFFEE_MACHINE_POSITION: [number, number, number] = [8.6, 0, -5.4];

const LEFT_BOOKSHELF_POSITION: [number, number, number] = [-10.1, 0, -1.8];
const RIGHT_BOOKSHELF_POSITION: [number, number, number] = [10.1, 0, -1.8];

const FRONT_WINDOW_POSITION: [number, number, number] = [5.2, 2.5, -9.85];
const SIDE_WINDOW_POSITION: [number, number, number] = [-14.85, 2.5, 0.4];

const COLLAB_ZONE_CENTER: [number, number, number] = [0, 0, -5.9];
const FOCUS_ZONE_CENTER: [number, number, number] = [-10.5, 0, -3.2];
const BREAK_ZONE_CENTER: [number, number, number] = [9.2, 0, -4.9];

const WALKWAY_LANES: WalkwayLane[] = [
  {
    id: "main-corridor",
    position: [0, 0.012, 1.3],
    size: [14.5, 1.25],
    color: "#2f394a",
    emissive: "#1e3a8a",
  },
  {
    id: "collab-connector",
    position: [0, 0.012, -2.9],
    size: [1.25, 6.2],
    color: "#364152",
    emissive: "#0f766e",
  },
  {
    id: "left-focus-connector",
    position: [-6.6, 0.012, -2.6],
    size: [4.1, 1.1],
    color: "#303949",
    emissive: "#6b7280",
  },
  {
    id: "right-break-connector",
    position: [6.2, 0.012, -3.55],
    size: [4.4, 0.95],
    color: "#2f3d46",
    emissive: "#0f766e",
  },
];

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const IDLE_WINDOW_MS = 30 * 60 * 1000;
const SUBAGENT_DESK_BOUNDS = {
  minX: -8.4,
  maxX: 8.4,
  minZ: -6.4,
  maxZ: 6.4,
} as const;

const FETCH_TIMEOUT_MS = 10000; // 10 seconds timeout

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSubagentId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSameSubagent(configuredName: string, runtimeName: string): boolean {
  const configured = normalizeSubagentId(configuredName);
  const runtime = normalizeSubagentId(runtimeName);

  if (!configured || !runtime) {
    return false;
  }

  return configured === runtime || runtime.includes(configured) || configured.includes(runtime);
}

function buildSubagentOfficeId(parentId: string, subagentId: string): string {
  return `${parentId}:${subagentId}`;
}

function getVisitorStatus(ageMs: number): Visitor["status"] {
  if (ageMs < ONLINE_WINDOW_MS) {
    return "active";
  }
  if (ageMs < IDLE_WINDOW_MS) {
    return "idle";
  }
  return "offline";
}

function parseParentFromKey(key: string): string {
  const parts = key.split(":");
  return parts[1] || "main";
}

export default function Office3D() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [interactionModal, setInteractionModal] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<'orbit' | 'fps'>('orbit');
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [configuredSubagents, setConfiguredSubagents] = useState<ConfiguredSubagent[]>([]);
  // Use ref instead of state to avoid re-renders on every frame
  // WalkingAvatar will update this directly via callback
  const walkingAvatarPositionsRef = useRef<Map<string, Vector3>>(new Map());
  const [loading, setLoading] = useState(true);

  // Update walking avatar position - writes to ref, no re-renders
  const handleWalkingPositionUpdate = (id: string, pos: Vector3) => {
    walkingAvatarPositionsRef.current.set(id, pos.clone());
  };

  // Get agent state with fallback
  const getAgentState = (agentId: string): AgentState => {
    return agentStates[agentId] || {
      id: agentId,
      status: 'offline',
      model: 'unknown',
      tokensPerHour: 0,
      tasksInQueue: 0,
      uptime: 0,
    };
  };

  // Unified polling: fetch configs (5min), statuses (15s), and visitors (15s) in one effect
  useEffect(() => {
    let isMounted = true;
    let configInterval: NodeJS.Timeout | null = null;
    let statusInterval: NodeJS.Timeout | null = null;

    // Fetch full configuration (agents + statuses + subagents) - runs once and every 5 minutes
    const fetchFullConfig = async () => {
      try {
        const agentsWithDesks = await fetchOfficeAgents();
        
        if (agentsWithDesks.length === 0) {
          setAgents([{
            id: 'main',
            name: 'Main Agent',
            emoji: '🤖',
            position: [0, 0, 0],
            deskRotation: [0, 0, 0],
            tableId: 'core-1',
            color: '#ff6b35',
            role: 'Main Agent',
            department: 'core',
          }]);
          setConfiguredSubagents([]);
          setLoading(false);
          return;
        }
        
        const statusMap = await fetchAgentStatuses();

        let agentsApiList: AgentApiItem[] = [];
        const agentsRes = await fetchWithTimeout("/api/agents");
        if (agentsRes.ok) {
          const agentsApiData: AgentApiResponse = await agentsRes.json();
          agentsApiList = agentsApiData.agents || [];
        }

        const agentDetailsById = new Map<string, AgentApiItem>();
        agentsApiList.forEach((agent) => {
          agentDetailsById.set(agent.id, agent);
        });

        const configuredSubagentIds = new Set<string>();
        agentsApiList.forEach((agent) => {
          (agent.allowAgents || []).forEach((subagentId) => {
            configuredSubagentIds.add(subagentId);
          });
        });

        const primaryAgents = agentsWithDesks.filter((agent) => !configuredSubagentIds.has(agent.id));

        const configs = primaryAgents.map((desk) => ({
          id: desk.id,
          name: desk.name,
          emoji: desk.emoji,
          color: desk.color,
          role: desk.role,
          position: [desk.deskPosition.x, desk.deskPosition.y, desk.deskPosition.z] as [number, number, number],
          deskRotation: [0, desk.deskPosition.rotation, 0] as [number, number, number],
          accessories: desk.accessories,
        }));
        
        setAgents(configs);

        if (agentsApiList.length > 0) {
          const nextConfiguredSubagents: ConfiguredSubagent[] = [];

          agentsApiList.forEach((parentAgent) => {
            const allowed = parentAgent.allowAgents || [];
            allowed.forEach((subagentId) => {
              const details = parentAgent.allowAgentsDetails?.find((entry) => entry.id === subagentId);
              nextConfiguredSubagents.push({
                id: buildSubagentOfficeId(parentAgent.id, subagentId),
                parentId: parentAgent.id,
                subagentId,
                name: details?.name || subagentId,
                emoji: details?.emoji || "🤖",
                color: details?.color || "#60a5fa",
              });
            });
          });

          const uniqueConfiguredSubagents = new Map<string, ConfiguredSubagent>();
          nextConfiguredSubagents.forEach((subagent) => {
            uniqueConfiguredSubagents.set(subagent.id, subagent);
          });

          setConfiguredSubagents(Array.from(uniqueConfiguredSubagents.values()));
        } else {
          setConfiguredSubagents([]);
        }
        
        const states: Record<string, AgentState> = {};
        agentsWithDesks.forEach((agent) => {
          const statusInfo = statusMap.get(agent.id);
          const details = agentDetailsById.get(agent.id);
          const agentStatus: AgentStatus = statusInfo?.status 
            ? (["idle", "working", "thinking", "error", "online", "offline"].includes(statusInfo.status) 
              ? statusInfo.status as AgentStatus 
              : "offline")
            : "offline";
             
          states[agent.id] = {
            id: agent.id,
            status: agentStatus,
            currentTask: statusInfo?.currentTask,
            model: details?.model,
            tokensUsed: details?.tokensUsed,
            sessionCount: details?.sessionCount ?? statusInfo?.activeSessions,
            lastActivity: statusInfo?.lastActivity,
            mood: details?.mood,
          };
        });
        setAgentStates(states);
      } catch (error) {
        console.error('Failed to load agent configs:', error);
        setAgents([{
          id: 'main',
          name: 'Main Agent',
          emoji: '🤖',
          position: [0, 0, 0],
          deskRotation: [0, 0, 0],
          tableId: 'core-1',
          color: '#ff6b35',
          role: 'Main Agent',
          department: 'core',
        }]);
        setConfiguredSubagents([]);
      } finally {
        setLoading(false);
      }
    };

    // Fetch statuses and visitors - runs every 15 seconds
    const fetchStatusesAndVisitors = async () => {
      if (!isMounted) return;

      try {
        // Fetch statuses
        const statusMap = await fetchAgentStatuses();

        setAgentStates((prev) => {
          const next: Record<string, AgentState> = { ...prev };
          statusMap.forEach((statusInfo, agentId) => {
            const nextStatus: AgentStatus = statusInfo?.status 
              ? (["idle", "working", "thinking", "error", "online", "offline"].includes(statusInfo.status) 
                ? statusInfo.status as AgentStatus 
                : "offline")
              : "offline";
            const current = next[agentId] || {
              id: agentId,
              status: "offline",
              model: "unknown",
              tokensPerHour: 0,
              tasksInQueue: 0,
              uptime: 0,
            };

            next[agentId] = {
              ...current,
              status: nextStatus,
              currentTask: statusInfo?.currentTask || current.currentTask,
              lastActivity: statusInfo?.lastActivity || current.lastActivity,
            };
          });
          return next;
        });

        // Fetch visitors (subagents)
        const res = await fetchWithTimeout("/api/sessions");
        if (!res.ok || !isMounted) return;

        const data = await res.json();
        const sessions = data.sessions || [];

        const visitorsById = new Map<string, Visitor>();

        sessions
          .filter((s: { type: string }) => s.type === "subagent")
          .map((s: {
            subagentId?: string;
            key: string;
            model: string;
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            ageMs?: number;
          }) => {
            const parentId = parseParentFromKey(s.key);
            const subagentId = s.subagentId || s.key;
            const ageMs = typeof s.ageMs === "number" ? s.ageMs : Number.MAX_SAFE_INTEGER;

            return {
              id: buildSubagentOfficeId(parentId, subagentId),
              parentId,
              subagentId,
              name: subagentId,
              task: "Working...",
              model: s.model || "unknown",
              tokens: s.totalTokens || s.inputTokens + s.outputTokens,
              status: getVisitorStatus(ageMs),
              ageMs,
            } as Visitor;
          })
          .forEach((visitor: Visitor) => {
            const current = visitorsById.get(visitor.id);
            if (!current || visitor.ageMs < current.ageMs) {
              visitorsById.set(visitor.id, visitor);
            }
          });

        setVisitors(Array.from(visitorsById.values()));
      } catch (error) {
        console.error("Failed to refresh statuses/visitors:", error);
      }
    };

    // Initial fetch
    fetchFullConfig();
    fetchStatusesAndVisitors();

    // Set up intervals
    statusInterval = setInterval(fetchStatusesAndVisitors, 15000);
    configInterval = setInterval(fetchFullConfig, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      if (statusInterval) clearInterval(statusInterval);
      if (configInterval) clearInterval(configInterval);
    };
  }, []);

  const handleDeskClick = (agentId: string) => {
    setSelectedAgent(agentId);
  };

  const handleClosePanel = () => {
    setSelectedAgent(null);
  };

  const handleFileCabinetClick = () => {
    setInteractionModal('memory');
  };

  const handleWhiteboardClick = () => {
    setInteractionModal('roadmap');
  };

  const handleCoffeeClick = () => {
    setInteractionModal('energy');
  };

  const handleCloseModal = () => {
    setInteractionModal(null);
  };

  const runtimeSubagentByConfiguredId = new Map<string, Visitor>();
  const usedRuntimeVisitorIds = new Set<string>();

  // Pass 1: strict/fuzzy identifier match
  configuredSubagents.forEach((subagent) => {
    const runtime = visitors.find(
      (visitor) =>
        !usedRuntimeVisitorIds.has(visitor.id) &&
        visitor.parentId === subagent.parentId &&
        (isSameSubagent(subagent.subagentId, visitor.subagentId) ||
          isSameSubagent(subagent.subagentId, visitor.name) ||
          isSameSubagent(subagent.name, visitor.name))
    );

    if (runtime) {
      runtimeSubagentByConfiguredId.set(subagent.id, runtime);
      usedRuntimeVisitorIds.add(runtime.id);
    }
  });

  // Pass 2: fallback by parent + recency order
  configuredSubagents.forEach((subagent) => {
    if (runtimeSubagentByConfiguredId.has(subagent.id)) {
      return;
    }

    const runtime = visitors
      .filter((visitor) => visitor.parentId === subagent.parentId && !usedRuntimeVisitorIds.has(visitor.id))
      .sort((a, b) => a.ageMs - b.ageMs)[0];

    if (runtime) {
      runtimeSubagentByConfiguredId.set(subagent.id, runtime);
      usedRuntimeVisitorIds.add(runtime.id);
    }
  });

  const subagentConfigs: AgentConfig[] = (() => {
    const configs: AgentConfig[] = [];
    const parentSubagentCounts = new Map<string, number>();

    configuredSubagents.forEach((subagent) => {
      const parentAgent = agents.find((agent) => agent.id === subagent.parentId);
      if (!parentAgent) return;

      const count = parentSubagentCounts.get(subagent.parentId) || 0;
      parentSubagentCounts.set(subagent.parentId, count + 1);

      const laneIndex = count % 3;
      const laneOffsets = [-3.2, 0, 3.2] as const;
      const column = Math.floor(count / 3);

      // Prefer inward placement so desks do not cross side walls.
      const side = parentAgent.position[0] >= 0 ? -1 : 1;
      const offsetX = side * (3.8 + column * 3.0);
      const offsetZ = laneOffsets[laneIndex];

      const subagentPosition: [number, number, number] = [
        clamp(parentAgent.position[0] + offsetX, SUBAGENT_DESK_BOUNDS.minX, SUBAGENT_DESK_BOUNDS.maxX),
        0,
        clamp(parentAgent.position[2] + offsetZ, SUBAGENT_DESK_BOUNDS.minZ, SUBAGENT_DESK_BOUNDS.maxZ),
      ];

      const runtime = runtimeSubagentByConfiguredId.get(subagent.id);

      configs.push({
        id: subagent.id,
        name: subagent.name,
        emoji: subagent.emoji,
        position: subagentPosition,
        color: subagent.color,
        role: "Sub-agent",
        parentId: subagent.parentId,
        currentTask: runtime?.task,
      });
    });

    return configs;
  })();

  const subagentStateById = new Map<string, AgentStatus>(
    configuredSubagents.map((subagent) => {
      const configuredSubagentState = agentStates[subagent.subagentId];
      if (configuredSubagentState) {
        return [subagent.id, configuredSubagentState.status];
      }

      const runtime = runtimeSubagentByConfiguredId.get(subagent.id);
      const status: AgentStatus =
        runtime?.status === "active" ? "working" : runtime?.status === "idle" ? "idle" : "offline";
      return [subagent.id, status];
    })
  );

  const selectedAgentConfig = selectedAgent
    ? agents.find((agent) => agent.id === selectedAgent) || subagentConfigs.find((agent) => agent.id === selectedAgent) || null
    : null;

  const selectedConfiguredSubagent = selectedAgent
    ? configuredSubagents.find((subagent) => subagent.id === selectedAgent) || null
    : null;

  const selectedPanelAgent: AgentConfig | null = (() => {
    if (!selectedAgentConfig) {
      return null;
    }

    if (!selectedConfiguredSubagent) {
      return selectedAgentConfig;
    }

    return {
      ...selectedAgentConfig,
      id: selectedConfiguredSubagent.subagentId,
      name: selectedConfiguredSubagent.name,
      emoji: selectedConfiguredSubagent.emoji,
      color: selectedConfiguredSubagent.color,
    };
  })();

  const selectedAgentState: AgentState | null = (() => {
    if (!selectedAgent || !selectedAgentConfig) {
      return null;
    }

    const primary = agents.find((agent) => agent.id === selectedAgent);
    if (primary) {
      return getAgentState(selectedAgent);
    }

    const runtime = runtimeSubagentByConfiguredId.get(selectedAgent);
    const configuredState = selectedConfiguredSubagent
      ? agentStates[selectedConfiguredSubagent.subagentId]
      : undefined;
    const status = subagentStateById.get(selectedAgent) || "offline";

    return {
      id: selectedAgent,
      status,
      currentTask: configuredState?.currentTask || runtime?.task,
      model: configuredState?.model || runtime?.model,
      tokensUsed: configuredState?.tokensUsed ?? runtime?.tokens,
      sessionCount: configuredState?.sessionCount ?? (runtime ? 1 : 0),
      lastActivity:
        configuredState?.lastActivity ||
        (runtime ? new Date(Date.now() - runtime.ageMs).toISOString() : undefined),
      mood: configuredState?.mood,
    };
  })();

  // Obstáculos para visitors y walking avatars
  const obstacles = [
    // Archivador
    { position: new Vector3(...FILE_CABINET_POSITION), radius: 0.85 },
    // Pizarra
    { position: new Vector3(...WHITEBOARD_POSITION), radius: 1.45 },
    // Máquina de café
    { position: new Vector3(...COFFEE_MACHINE_POSITION), radius: 0.8 },
    // Estanterías
    { position: new Vector3(...LEFT_BOOKSHELF_POSITION), radius: 0.95 },
    { position: new Vector3(...RIGHT_BOOKSHELF_POSITION), radius: 0.95 },
    // Zonas premium
    { position: new Vector3(...COLLAB_ZONE_CENTER), radius: 1.85 },
    { position: new Vector3(...FOCUS_ZONE_CENTER), radius: 1.25 },
    { position: new Vector3(...BREAK_ZONE_CENTER), radius: 0.95 },
    // Plantas
    ...PLANT_DECORATIONS.map((plant) => ({
      position: new Vector3(...plant.position),
      radius: plant.radius,
    })),
    // Escritorios (agent positions)
    ...agents.map((agent) => ({ position: new Vector3(...agent.position), radius: 0.8 })),
    ...subagentConfigs.map((subagent) => ({ position: new Vector3(...subagent.position), radius: 0.8 })),
  ];

  // Office bounds for walking avatars - expanded for more walking area
  const officeBounds = {
    minX: -12,
    maxX: 12,
    minZ: -9,
    maxZ: 9,
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-neutral-900 flex items-center justify-center" style={{ height: '100vh', width: '100vw' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-warning mx-auto mb-4"></div>
          <p className="text-neutral-400 text-lg">Loading office...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-900" style={{ height: '100vh', width: '100vw' }}>
      <Canvas
        camera={{ position: [0, 8, 12], fov: 60 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
        onPointerMissed={() => {}}
      >
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[2, 2, 2]} />
            <meshStandardMaterial color="orange" />
          </mesh>
        }>
          {/* Iluminación */}
          <Lights />

          {/* Cielo y ambiente */}
          <Sky sunPosition={[100, 20, 100]} />
          <Environment preset="sunset" />

          {/* Suelo */}
          <Floor />

          {/* Paredes */}
          <Walls />

          {/* Techo: visible solo en modo FPS para no bloquear la vista cenital */}
          {controlMode === 'fps' && <Ceiling />}

          {/* Open Office Premium: circulation lanes */}
          {WALKWAY_LANES.map((lane) => (
            <mesh
              key={lane.id}
              position={lane.position}
              rotation={[-Math.PI / 2, lane.rotationY || 0, 0]}
              receiveShadow
            >
              <planeGeometry args={lane.size} />
              <meshStandardMaterial
                color={lane.color}
                roughness={0.92}
                metalness={0.06}
                emissive={lane.emissive || "#000000"}
                emissiveIntensity={0.12}
              />
            </mesh>
          ))}

          {/* Open Office Premium: collaboration zone near whiteboard */}
          <group>
            <mesh position={[COLLAB_ZONE_CENTER[0], 0.015, COLLAB_ZONE_CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[4.8, 2.6]} />
              <meshStandardMaterial color="#2b3445" roughness={0.9} metalness={0.05} />
            </mesh>

            <CollabTable position={[COLLAB_ZONE_CENTER[0], 0, COLLAB_ZONE_CENTER[2]]} />

            {[
              [-1.6, -1.1, 0],
              [1.6, -1.1, 0],
              [-1.6, 1.1, Math.PI],
              [1.6, 1.1, Math.PI],
            ].map(([x, z, rot], index) => (
              <LoungeChair
                key={`collab-chair-${index}`}
                position={[COLLAB_ZONE_CENTER[0] + Number(x), 0, COLLAB_ZONE_CENTER[2] + Number(z)]}
                rotation={[0, Number(rot), 0]}
                variant="task"
              />
            ))}

            <spotLight
              position={[COLLAB_ZONE_CENTER[0], 4.2, COLLAB_ZONE_CENTER[2] + 0.5]}
              angle={0.5}
              penumbra={0.5}
              intensity={0.4}
              distance={11}
              color="#f8fafc"
              castShadow
            />
            <pointLight position={[COLLAB_ZONE_CENTER[0] - 1.8, 1.8, COLLAB_ZONE_CENTER[2] + 0.1]} intensity={0.14} distance={6} color="#93c5fd" />
            <pointLight position={[COLLAB_ZONE_CENTER[0] + 1.9, 1.7, COLLAB_ZONE_CENTER[2] - 0.1]} intensity={0.12} distance={6} color="#fde68a" />
          </group>

          {/* Open Office Premium: focus zone by bookshelves */}
          <group>
            <mesh position={[FOCUS_ZONE_CENTER[0], 0.015, FOCUS_ZONE_CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[2.8, 1.8]} />
              <meshStandardMaterial color="#3f2f2f" roughness={0.92} metalness={0.02} />
            </mesh>

            <Box args={[1.5, 0.1, 0.7]} position={[FOCUS_ZONE_CENTER[0], 0.74, FOCUS_ZONE_CENTER[2] + 0.05]} castShadow>
              <meshStandardMaterial color="#65473a" roughness={0.72} />
            </Box>

            <LoungeChair
              position={[FOCUS_ZONE_CENTER[0] + 1.15, 0, FOCUS_ZONE_CENTER[2] + 0.15]}
              rotation={[0, -Math.PI / 2, 0]}
              variant="executive"
              color="#0f172a"
            />

            {/* Floor lamp with proper stand */}
            <mesh position={[FOCUS_ZONE_CENTER[0] - 0.55, 0, FOCUS_ZONE_CENTER[2] - 0.2]} castShadow>
              <cylinderGeometry args={[0.04, 0.04, 0.02, 12]} />
              <meshStandardMaterial color="#1f2937" metalness={0.6} roughness={0.4} />
            </mesh>
            <mesh position={[FOCUS_ZONE_CENTER[0] - 0.55, 0.35, FOCUS_ZONE_CENTER[2] - 0.2]} castShadow>
              <cylinderGeometry args={[0.02, 0.02, 0.7, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.45} roughness={0.4} />
            </mesh>
            <mesh position={[FOCUS_ZONE_CENTER[0] - 0.55, 0.74, FOCUS_ZONE_CENTER[2] - 0.2]} castShadow>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshStandardMaterial color="#fde68a" emissive="#d97706" emissiveIntensity={0.24} />
            </mesh>

            <pointLight position={[FOCUS_ZONE_CENTER[0] - 0.45, 1.8, FOCUS_ZONE_CENTER[2] - 0.2]} intensity={0.2} distance={4} color="#fde68a" />
            <pointLight position={[FOCUS_ZONE_CENTER[0] + 1.2, 1.5, FOCUS_ZONE_CENTER[2] + 0.2]} intensity={0.08} distance={3.2} color="#60a5fa" />
          </group>

          {/* Open Office Premium: break accent around coffee point */}
          <group>
            <mesh position={[BREAK_ZONE_CENTER[0], 0.015, BREAK_ZONE_CENTER[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[2.3, 1.6]} />
              <meshStandardMaterial color="#1f3b3b" roughness={0.9} metalness={0.05} />
            </mesh>

            <mesh position={[BREAK_ZONE_CENTER[0] - 0.55, 0.42, BREAK_ZONE_CENTER[2] - 0.35]} castShadow>
              <cylinderGeometry args={[0.23, 0.23, 0.82, 20]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
            <mesh position={[BREAK_ZONE_CENTER[0] - 0.55, 0.87, BREAK_ZONE_CENTER[2] - 0.35]} castShadow>
              <cylinderGeometry args={[0.28, 0.28, 0.06, 20]} />
              <meshStandardMaterial color="#e2e8f0" />
            </mesh>

            <LoungeChair
              position={[BREAK_ZONE_CENTER[0] + 0.85, 0, BREAK_ZONE_CENTER[2] + 0.05]}
              rotation={[0, -Math.PI / 2.8, 0]}
              variant="lounge"
              color="#334155"
            />

            <pointLight position={[BREAK_ZONE_CENTER[0] - 0.4, 1.4, BREAK_ZONE_CENTER[2] - 0.4]} intensity={0.12} distance={3.6} color="#fbbf24" />
            <pointLight position={[BREAK_ZONE_CENTER[0] + 0.8, 1.2, BREAK_ZONE_CENTER[2] + 0.2]} intensity={0.08} distance={3.2} color="#a7f3d0" />
          </group>

          {/* Escritorios de agentes */}
          {agents.map((agent) => (
            <AgentDesk
              key={agent.id}
              agentId={agent.id}
              agentName={agent.name}
              agentColor={agent.color}
              agentEmoji={agent.emoji}
              agentRole={agent.role}
              agentAccessories={agent.accessories}
              deskPosition={agent.position}
              deskRotation={agent.deskRotation}
              avatarState={getAgentState(agent.id).status}
              currentTask={getAgentState(agent.id).currentTask}
              onClick={() => handleDeskClick(agent.id)}
              isSelected={selectedAgent === agent.id}
            />
          ))}

          {/* Walking avatars - only idle agents walk around the office */}
          {/* offline agents are NOT in the office, working/thinking are at their desks */}
          {agents.map((agent) => {
            const status = getAgentState(agent.id).status;
            const shouldWalk = status === 'idle';
            return (
              <WalkingAvatar
                key={`walking-${agent.id}`}
                agent={agent}
                status={status}
                visible={shouldWalk}
                officeBounds={officeBounds}
                obstacles={obstacles}
                otherAvatarPositions={walkingAvatarPositionsRef.current}
                onPositionUpdate={handleWalkingPositionUpdate}
              />
            );
          })}

          {/* Subagent desks */}
          {subagentConfigs.map((config) => {
            const avatarState = subagentStateById.get(config.id) ?? "offline";
            const parentAgent = agents.find((agent) => agent.id === config.parentId);
            const parentPos: [number, number, number] = parentAgent
              ? [parentAgent.position[0], 1.0, parentAgent.position[2]]
              : [0, 1.0, 0];

            return (
              <group key={`subagent-group-${config.id}`}>
                <AgentDesk
                  agentId={config.id}
                  agentName={config.name}
                  agentColor={config.color}
                  agentEmoji={config.emoji}
                  agentRole={config.role}
                  agentAccessories={getDefaultAccessories(config.id)}
                  deskPosition={config.position}
                  deskRotation={[0, 0, 0]}
                  avatarState={avatarState}
                  currentTask={config.currentTask}
                  onClick={() => handleDeskClick(config.id)}
                  isSelected={selectedAgent === config.id}
                />
                {parentAgent && avatarState !== "offline" && (
                  <AgentConnection
                    from={parentPos}
                    to={[config.position[0], 1.0, config.position[2]]}
                    status={avatarState === "idle" ? "idle" : "active"}
                    taskName={config.currentTask}
                  />
                )}
              </group>
            );
          })}

          {/* Idle subagents walk around the office */}
          {subagentConfigs.map((subagent) => {
            const status = subagentStateById.get(subagent.id) ?? "offline";
            return (
              <WalkingAvatar
                key={`subagent-walking-${subagent.id}`}
                agent={subagent}
                status={status}
                visible={status === "idle"}
                officeBounds={officeBounds}
                obstacles={obstacles}
                otherAvatarPositions={walkingAvatarPositionsRef.current}
                onPositionUpdate={handleWalkingPositionUpdate}
              />
            );
          })}

          {/* Mobiliario interactivo */}
          <FileCabinet
            position={FILE_CABINET_POSITION}
            onClick={handleFileCabinetClick}
          />
          <Whiteboard
            position={WHITEBOARD_POSITION}
            rotation={[0, 0, 0]}
            onClick={handleWhiteboardClick}
          />
          <CoffeeMachine
            position={COFFEE_MACHINE_POSITION}
            onClick={handleCoffeeClick}
          />

          {/* Ventanas */}
          <Window position={FRONT_WINDOW_POSITION} size={[2.6, 1.8]} />
          <Window
            position={SIDE_WINDOW_POSITION}
            rotation={[0, Math.PI / 2, 0]}
            size={[2.2, 1.6]}
          />

          <Bookshelf position={LEFT_BOOKSHELF_POSITION} rotation={[0, Math.PI / 2, 0]} />
          <Bookshelf position={RIGHT_BOOKSHELF_POSITION} rotation={[0, -Math.PI / 2, 0]} />

          {/* Decoración verde */}
          {PLANT_DECORATIONS.map((plant, index) => (
            <PlantPot
              key={`plant-${index}`}
              position={plant.position}
              size={plant.size}
              type={plant.type}
            />
          ))}
          <WallClock
            position={[0, 2.8, -7.6]}
            rotation={[0, 0, 0]}
          />

          {/* Controles de cámara */}
          {controlMode === 'orbit' ? (
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              minDistance={5}
              maxDistance={30}
              maxPolarAngle={Math.PI / 2.2}
            />
          ) : (
              <FirstPersonControls moveSpeed={5} />
            )}

          {/* Post-processing - cinematic look with bloom, vignette, and tone mapping */}
          <EffectComposer>
            <Bloom
              intensity={0.35}
              luminanceThreshold={0.85}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <Vignette
              offset={0.4}
              darkness={0.4}
              eskil={false}
            />
            <ToneMapping
              mode={ToneMappingMode.ACES_FILMIC}
              resolution={256}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Panel lateral cuando se selecciona un agente */}
      {selectedPanelAgent && selectedAgentState && (
        <AgentPanel
          agent={selectedPanelAgent}
          state={selectedAgentState}
          onClose={handleClosePanel}
        />
      )}

      {/* Modales de interacciones con objetos */}
      {interactionModal === 'memory' && (
        <MemoryModal onClose={handleCloseModal} />
      )}
      {interactionModal === 'roadmap' && (
        <RoadmapModal onClose={handleCloseModal} />
      )}
      {interactionModal === 'energy' && (
        <EnergyModal onClose={handleCloseModal} />
      )}

      {/* Controles UI overlay */}
      <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
        <h2 className="text-lg font-bold mb-2">🏢 The Office</h2>
        <div className="text-sm space-y-1 mb-3">
          <p><strong>Mode: {controlMode === 'orbit' ? '🖱️ Orbit' : '🎮 FPS'}</strong></p>
          {controlMode === 'orbit' ? (
            <>
              <p>🖱️ Mouse: Rotar vista</p>
              <p>🔄 Scroll: Zoom</p>
              <p>👆 Click: Seleccionar</p>
            </>
          ) : (
            <>
              <p>Click to lock cursor</p>
              <p>WASD/Arrows: Mover</p>
              <p>Space: Subir | Shift: Bajar</p>
              <p>Mouse: Mirar | ESC: Unlock</p>
            </>
          )}
        </div>
        <button
          onClick={() => setControlMode(controlMode === 'orbit' ? 'fps' : 'orbit')}
          className="w-full bg-warning hover:bg-warning text-black font-bold py-2 px-3 rounded text-xs transition-colors"
        >
          Switch to {controlMode === 'orbit' ? 'FPS Mode' : 'Orbit Mode'}
        </button>
      </div>

    </div>
  );
}
