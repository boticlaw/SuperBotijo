"use client";

import { useState, useRef, useEffect } from "react";
import { DEPARTMENTS, type DepartmentId, groupAgentsByDepartment } from "@/lib/agent-auto-config";

type AgentStatus = "working" | "idle" | "error" | "paused" | "online" | "offline";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  model: string;
  allowAgents: string[];
  allowAgentsDetails?: Array<{ id: string; name: string; emoji: string; color: string }>;
  status: AgentStatus;
  activeSessions: number;
  skills?: string[];
}

interface AgentOrganigramaProps {
  agents: Agent[];
}

// Department display order (sorted by importance)
const DEPARTMENT_ORDER: DepartmentId[] = [
  "DEVELOPMENT",
  "DATA_EXTRACTION",
  "MEMORY_NOTES",
  "COMMUNICATION",
  "ENTERTAINMENT",
  "GENERAL",
  "OTHER",
];

interface Connection {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export function AgentOrganigrama({ agents }: AgentOrganigramaProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const hqRef = useRef<HTMLDivElement>(null);
  const deptRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Find the root agent (the one with subagents - HQ)
  const rootAgent = agents.find((a) => a.allowAgents && a.allowAgents.length > 0);
  const rootAgentId = rootAgent?.id || null;

  // Get subagent IDs of the root agent
  const subagentIds = new Set(rootAgent?.allowAgents || []);

  // Separate root agent from other agents
  const otherAgents = rootAgentId
    ? agents.filter((a) => a.id !== rootAgentId)
    : agents;

  // Group other agents by department
  const grouped = groupAgentsByDepartment(otherAgents);

  // Get departments that have agents
  const departmentsWithAgents = DEPARTMENT_ORDER.filter(
    (deptId) => grouped[deptId]?.length
  );

  // Calculate connections after render
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!containerRef.current || !hqRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const hqRect = hqRef.current.getBoundingClientRect();

      const newConnections: Connection[] = [];

      // HQ center bottom point
      const hqX = hqRect.left + hqRect.width / 2 - containerRect.left;
      const hqY = hqRect.bottom - containerRect.top;

      // Connect HQ to each department section
      for (const deptId of departmentsWithAgents) {
        const deptEl = deptRefs.current[deptId];
        if (!deptEl) continue;

        const deptRect = deptEl.getBoundingClientRect();
        const deptX = deptRect.left + deptRect.width / 2 - containerRect.left;
        const deptY = deptRect.top - containerRect.top;

        newConnections.push({
          id: `hq-${deptId}`,
          x1: hqX,
          y1: hqY,
          x2: deptX,
          y2: deptY,
          color: rootAgent?.color || "#6366f1",
        });
      }

      setConnections(newConnections);
    }, 200);

    return () => clearTimeout(timer);
  }, [agents, rootAgent, departmentsWithAgents]);

  // Recalculate on resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !hqRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const hqRect = hqRef.current.getBoundingClientRect();

      const newConnections: Connection[] = [];

      const hqX = hqRect.left + hqRect.width / 2 - containerRect.left;
      const hqY = hqRect.bottom - containerRect.top;

      for (const deptId of departmentsWithAgents) {
        const deptEl = deptRefs.current[deptId];
        if (!deptEl) continue;

        const deptRect = deptEl.getBoundingClientRect();
        const deptX = deptRect.left + deptRect.width / 2 - containerRect.left;
        const deptY = deptRect.top - containerRect.top;

        newConnections.push({
          id: `hq-${deptId}`,
          x1: hqX,
          y1: hqY,
          x2: deptX,
          y2: deptY,
          color: rootAgent?.color || "#6366f1",
        });
      }

      setConnections(newConnections);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [departmentsWithAgents, rootAgent]);

  // No agents case
  if (agents.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
        No agents configured
      </div>
    );
  }

  // No root agent case - show simple grid
  if (!rootAgent) {
    return (
      <div style={{ padding: "1rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {DEPARTMENT_ORDER.map((deptId) => {
            const deptAgents = grouped[deptId];
            if (!deptAgents || deptAgents.length === 0) return null;

            return (
              <DepartmentCard
                key={deptId}
                deptId={deptId}
                agents={deptAgents}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ padding: "1rem", position: "relative" }}>
      {/* SVG Layer */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 0,
          minHeight: "800px",
        }}
      >
        {connections.map((conn) => (
          <g key={conn.id}>
            {/* Bezier curve */}
            <path
              d={`M ${conn.x1} ${conn.y1} 
                  C ${conn.x1} ${conn.y1 + 40}, 
                    ${conn.x2} ${conn.y2 - 40}, 
                    ${conn.x2} ${conn.y2}`}
              stroke={conn.color}
              strokeWidth="2"
              fill="none"
              strokeDasharray="6,4"
              opacity="0.5"
            />
            {/* Circle at start */}
            <circle cx={conn.x1} cy={conn.y1} r="4" fill={conn.color} opacity="0.6" />
            {/* Circle at end */}
            <circle cx={conn.x2} cy={conn.y2} r="4" fill={conn.color} opacity="0.6" />
          </g>
        ))}
      </svg>

      {/* HQ Section - Root Agent */}
      <div
        ref={hqRef}
        style={{
          marginBottom: "80px",
          position: "relative",
          zIndex: 1,
          maxWidth: "500px",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <div
          style={{
            backgroundColor: `${rootAgent.color}08`,
            borderRadius: "16px",
            border: `2px solid ${rootAgent.color}`,
            overflow: "hidden",
            boxShadow: `0 4px 20px ${rootAgent.color}20`,
          }}
        >
          {/* HQ Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              backgroundColor: `${rootAgent.color}15`,
              borderBottom: `1px solid ${rootAgent.color}20`,
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>{rootAgent.emoji}</span>
            <div style={{ flex: 1 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  color: rootAgent.color,
                }}
              >
                {rootAgent.name}
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}> (HQ)</span>
              </h3>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {rootAgent.allowAgents?.length || 0} subagent{(rootAgent.allowAgents?.length || 0) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Model */}
          <div
            style={{
              padding: "0.5rem 1rem",
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              backgroundColor: "var(--card)",
            }}
          >
            {rootAgent.model.split("/").pop() || rootAgent.model}
          </div>
        </div>
      </div>

      {/* Other Departments Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        {departmentsWithAgents.map((deptId) => {
          const deptAgents = grouped[deptId];
          if (!deptAgents || deptAgents.length === 0) return null;

          return (
            <div
              key={deptId}
              ref={(el) => {
                deptRefs.current[deptId] = el;
              }}
            >
              <DepartmentCard
                deptId={deptId}
                agents={deptAgents}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
              />
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          justifyContent: "center",
          marginTop: "2rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border)",
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#4ade80" }} />
          Online
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#6b7280" }} />
          Offline
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ width: "20px", height: "2px", backgroundColor: rootAgent?.color || "#6366f1", opacity: 0.5 }} />
          Connection
        </span>
      </div>
    </div>
  );
}

// Department Card Component
interface DepartmentCardProps {
  deptId: DepartmentId;
  agents: Agent[];
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
}

function DepartmentCard({ deptId, agents, hoveredId, setHoveredId }: DepartmentCardProps) {
  const dept = DEPARTMENTS[deptId];

  return (
    <div
      style={{
        backgroundColor: `${dept.color}08`,
        borderRadius: "16px",
        border: `2px solid ${dept.color}30`,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          backgroundColor: `${dept.color}15`,
          borderBottom: `1px solid ${dept.color}20`,
        }}
      >
        <span style={{ fontSize: "1.5rem" }}>{dept.emoji}</span>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {dept.name}
          </h3>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            {agents.length} agent{agents.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Agents List */}
      <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {agents.map((agent) => {
          const isHovered = hoveredId === agent.id;
          const isOnline = agent.status === "online";

          return (
            <div
              key={agent.id}
              onMouseEnter={() => setHoveredId(agent.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "10px",
                backgroundColor: isHovered ? `${agent.color}12` : "var(--card)",
                border: `1px solid ${isHovered ? agent.color : "var(--border)"}`,
                transition: "all 0.2s",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>{agent.emoji}</span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: "0.85rem",
                  }}
                >
                  {agent.name}
                </span>

                {/* Status */}
                <div
                  style={{
                    marginLeft: "auto",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: isOnline ? "#4ade80" : "#6b7280",
                  }}
                />

                {/* Active sessions */}
                {agent.activeSessions > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: "18px",
                      height: "18px",
                      borderRadius: "9px",
                      backgroundColor: "rgba(255,59,48,0.15)",
                      border: "1px solid var(--accent)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                      padding: "0 5px",
                    }}
                  >
                    {agent.activeSessions}
                  </div>
                )}
              </div>

              {/* Model */}
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-muted)",
                  marginTop: "0.15rem",
                  marginLeft: "1.7rem",
                }}
              >
                {agent.model.split("/").pop() || agent.model}
              </div>

              {/* Skills */}
              {agent.skills && agent.skills.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.25rem",
                    marginTop: "0.35rem",
                    marginLeft: "1.7rem",
                  }}
                >
                  {agent.skills.map((skill) => (
                    <div
                      key={skill}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "3px",
                        backgroundColor: "var(--card-elevated)",
                        border: "1px solid var(--border)",
                        fontSize: "0.55rem",
                        color: "var(--text-secondary)",
                        fontFamily: "monospace",
                      }}
                    >
                      {skill}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
