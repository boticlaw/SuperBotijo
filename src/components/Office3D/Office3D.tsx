'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Environment } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import { Vector3 } from 'three';
import type { AgentState, AgentStatus } from "./agentsConfig";
import AgentDesk from "./AgentDesk";
import Floor from './Floor';
import Walls from './Walls';
import Lights from './Lights';
import AgentPanel from './AgentPanel';
import FileCabinet from './FileCabinet';
import Whiteboard from './Whiteboard';
import CoffeeMachine from './CoffeeMachine';
import PlantPot from './PlantPot';
import WallClock from './WallClock';
import FirstPersonControls from './FirstPersonControls';
import VisitorAvatar from './VisitorAvatar';
import { MemoryModal } from './MemoryModal';
import { RoadmapModal } from './RoadmapModal';
import { EnergyModal } from './EnergyModal';
import WalkingAvatar from './WalkingAvatar';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model?: string;
  workspace?: string;
  dmPolicy?: string;
  allowAgents?: string[];
  botToken?: string;
  status?: string;
  lastActivity?: string;
  activeSessions?: number;
  tokensUsed?: number;
  sessionCount?: number;
  currentTask?: string;
  mood?: {
    mood: string;
    emoji: string;
    streak: number;
    energyLevel: number;
  };
}

interface AgentStatusResponse {
  id: string;
  status: string;
  currentTask?: string;
  activeSessions?: number;
  lastActivity?: string;
}


interface Visitor {
  id: string;
  parentId: string;
  parentName: string;
  task: string;
  model: string;
  tokens: number;
  status: 'active' | 'idle';
}

interface AgentConfig {
  id: string;
  name: string;
  emoji: string;
  position: [number, number, number];
  color: string;
  role: string;
}

// Generate positions dynamically based on number of agents
function generateAgentPositions(agents: Agent[]): AgentConfig[] {
  const positions: [number, number, number][] = [
    [0, 0, 0],     // Center
    [-4, 0, -3],   // Back left
    [4, 0, -3],    // Back right
    [-4, 0, 3],    // Front left
    [4, 0, 3],     // Front right
    [0, 0, 6],     // Front center
    [-6, 0, 0],    // Far left
    [6, 0, 0],     // Far right
  ];

  return agents.map((agent, index) => ({
    id: agent.id,
    name: agent.name || agent.id,
    emoji: agent.emoji || '🤖',
    position: positions[index % positions.length],
    color: agent.color || '#666666',
    role: agent.id === 'main' ? 'Main Agent' : 'Agent',
  }));
}

export default function Office3D() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [interactionModal, setInteractionModal] = useState<string | null>(null);
  const [controlMode, setControlMode] = useState<'orbit' | 'fps'>('orbit');
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [walkingAvatarPositions, setWalkingAvatarPositions] = useState<Map<string, Vector3>>(new Map());
  const [loading, setLoading] = useState(true);

  // Update walking avatar position
  const handleWalkingPositionUpdate = (id: string, pos: Vector3) => {
    setWalkingAvatarPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(id, pos);
      return newMap;
    });
  };

  // Get agent state with fallback
  const getAgentState = (agentId: string): AgentState => {
    return agentStates[agentId] || {
      id: agentId,
      status: 'idle',
      model: 'unknown',
      tokensPerHour: 0,
      tasksInQueue: 0,
      uptime: 0,
    };
  };

  // Load agent configs (every 5 minutes)
  useEffect(() => {
    const fetchAgentConfigs = async () => {
      try {
        // Fetch full agent data from /api/agents
        const agentsRes = await fetch('/api/agents');
        const agentsData = await agentsRes.json();
        
        // Fetch dynamic statuses from /api/agents/status
        const statusRes = await fetch('/api/agents/status');
        const statusData = await statusRes.json();
        
        // Build status map for quick lookup
        const statusMap = new Map<string, AgentStatusResponse>();
        for (const s of statusData.agents || []) {
          statusMap.set(s.id, s as AgentStatusResponse);
        }
        
        // Combine data
        const realAgents = (agentsData.agents || []).map((agent: Agent) => {
          const statusInfo = statusMap.get(agent.id);
          return {
            ...agent,
            status: statusInfo?.status || agent.status || 'offline',
            currentTask: statusInfo?.currentTask || agent.currentTask,
            activeSessions: statusInfo?.activeSessions ?? agent.activeSessions ?? 0,
            lastActivity: statusInfo?.lastActivity || agent.lastActivity,
          };
        });
        
        const configs = generateAgentPositions(realAgents);
        setAgents(configs);
        
        // Build states with all the data
        const states: Record<string, AgentState> = {};
        realAgents.forEach((agent: Agent) => {
          const validStatuses: AgentStatus[] = ['idle', 'working', 'thinking', 'error', 'online', 'offline'];
          const agentStatus: AgentStatus = validStatuses.includes(agent.status as AgentStatus) 
            ? (agent.status as AgentStatus) 
            : 'offline';
            
          states[agent.id] = {
            id: agent.id,
            status: agentStatus,
            currentTask: agent.currentTask,
            model: agent.model,
            tokensUsed: agent.tokensUsed,
            sessionCount: agent.sessionCount,
            lastActivity: agent.lastActivity,
            mood: agent.mood,
          };
        });
        setAgentStates(states);
      } catch (error) {
        console.error('Failed to load agent configs:', error);
        // Fallback to main agent only
        setAgents([{
          id: 'main',
          name: 'Main Agent',
          emoji: '🤖',
          position: [0, 0, 0],
          color: '#ff6b35',
          role: 'Main Agent',
        }]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgentConfigs();
    const interval = setInterval(fetchAgentConfigs, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
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

  // Obstáculos para visitors y walking avatars
  const obstacles = [
    // Archivador
    { position: new Vector3(-8, 0, -5), radius: 0.8 },
    // Pizarra
    { position: new Vector3(0, 0, -8), radius: 1.5 },
    // Máquina de café
    { position: new Vector3(8, 0, -5), radius: 0.6 },
    // Plantas
    { position: new Vector3(-7, 0, 6), radius: 0.5 },
    { position: new Vector3(7, 0, 6), radius: 0.5 },
    { position: new Vector3(-9, 0, 0), radius: 0.4 },
    { position: new Vector3(9, 0, 0), radius: 0.4 },
    // Escritorios (agent positions)
    ...agents.map(a => ({ position: new Vector3(...a.position), radius: 1.2 })),
  ];

  // Office bounds for walking avatars
  const officeBounds = {
    minX: -10,
    maxX: 10,
    minZ: -8,
    maxZ: 8,
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

          {/* Escritorios de agentes */}
          {agents.map((agent) => (
            <AgentDesk
              key={agent.id}
              agent={agent}
              state={getAgentState(agent.id)}
              onClick={() => handleDeskClick(agent.id)}
              isSelected={selectedAgent === agent.id}
            />
          ))}

          {/* Walking avatars for idle/offline agents */}
          {agents
            .filter(agent => {
              const status = getAgentState(agent.id).status;
              return status === 'idle' || status === 'offline';
            })
            .map((agent) => (
              <WalkingAvatar
                key={`walking-${agent.id}`}
                agent={agent}
                status={getAgentState(agent.id).status}
                officeBounds={officeBounds}
                obstacles={obstacles}
                otherAvatarPositions={walkingAvatarPositions}
                onPositionUpdate={handleWalkingPositionUpdate}
              />
            ))}

          {/* Visitors (sub-agents) */}
          {visitors.map((visitor) => {
            const parentAgent = agents.find(a => a.id === visitor.parentId);
            if (!parentAgent) return null;
            
            return (
              <VisitorAvatar
                key={visitor.id}
                id={visitor.id}
                task={visitor.task}
                model={visitor.model}
                tokens={visitor.tokens}
                status={visitor.status}
                parentPosition={parentAgent.position}
                index={visitors.filter(v => v.parentId === visitor.parentId).indexOf(visitor)}
              />
            );
          })}

          {/* Mobiliario interactivo */}
          <FileCabinet
            position={[-8, 0, -5]}
            onClick={handleFileCabinetClick}
          />
          <Whiteboard
            position={[0, 0, -8]}
            rotation={[0, 0, 0]}
            onClick={handleWhiteboardClick}
          />
          <CoffeeMachine
            position={[8, 0.8, -5]}
            onClick={handleCoffeeClick}
          />

          {/* Decoración */}
          <PlantPot position={[-7, 0, 6]} size="large" />
          <PlantPot position={[7, 0, 6]} size="medium" />
          <PlantPot position={[-9, 0, 0]} size="small" />
          <PlantPot position={[9, 0, 0]} size="small" />
          <WallClock
            position={[0, 2.5, -8.4]}
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
        </Suspense>
      </Canvas>

      {/* Panel lateral cuando se selecciona un agente */}
      {selectedAgent && agents.find(a => a.id === selectedAgent) && (
        <AgentPanel
          agent={agents.find(a => a.id === selectedAgent)!}
          state={getAgentState(selectedAgent)}
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

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-black/70 text-white p-4 rounded-lg backdrop-blur-sm">
        <h3 className="text-sm font-bold mb-2">Estados</h3>
        <div className="text-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-success rounded-full"></div>
            <span>Working</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-info rounded-full animate-pulse"></div>
            <span>Thinking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-neutral-500 rounded-full"></div>
            <span>Idle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-error rounded-full"></div>
            <span>Error</span>
          </div>
        </div>
      </div>
    </div>
  );
}
