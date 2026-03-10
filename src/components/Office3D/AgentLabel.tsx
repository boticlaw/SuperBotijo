"use client";

import { Billboard, Text } from "@react-three/drei";
import type { AgentConfig, AgentStatus } from "./agentsConfig";

interface AgentLabelProps {
  agent: AgentConfig;
  status: AgentStatus;
}

const STATUS_COLORS: Record<AgentStatus, string> = {
  working: "#22c55e",
  online: "#4ade80",
  thinking: "#3b82f6",
  error: "#ef4444",
  idle: "#eab308",
  offline: "#6b7280",
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  working: "WORKING",
  online: "ONLINE",
  thinking: "THINKING",
  error: "ERROR",
  idle: "IDLE",
  offline: "OFFLINE",
};

/**
 * AgentLabel - Billboard label with name + emoji + status
 * Always faces the camera using Drei's Billboard component
 * Note: Includes counter-rotation for use inside rotated parent groups
 */
export function AgentLabel({ agent, status }: AgentLabelProps) {
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline;
  const statusLabel = STATUS_LABELS[status] || STATUS_LABELS.offline;

  return (
    <group rotation={[0, Math.PI, 0]}>
      <Billboard position={[0, 0.5, 0]} follow={true} lockX={false} lockZ={false}>
        {/* Main label: Emoji + Name */}
        <Text
          position={[0, 0.1, 0]}
          fontSize={0.12}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {agent.emoji} {agent.name}
        </Text>

        {/* Status label */}
        <Text
          position={[0, -0.05, 0]}
          fontSize={0.08}
          color={statusColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.005}
          outlineColor="#000000"
        >
          {statusLabel}
        </Text>
      </Billboard>
    </group>
  );
}
