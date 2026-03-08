"use client";

import { useState, useEffect } from "react";
import {
  Heart,
  Clock,
  Target,
  Edit3,
  Eye,
  Save,
  FileText,
  Loader2,
  CheckCircle2,
  Settings,
  User,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";

interface HeartbeatStatusProps {
  data: {
    enabled: boolean;
    every: string;
    target: string;
    activeHours: { start: string; end: string } | null;
    heartbeatMd: string;
    heartbeatMdPath: string;
    configured: boolean;
    agentHeartbeats?: AgentHeartbeat[];
  };
  onSave: (content: string, agentId?: string) => Promise<void>;
}

interface AgentHeartbeat {
  agentId: string;
  agentName: string;
  workspace: string;
  enabled: boolean;
  every: string;
  target: string;
  activeHours: { start: string; end: string } | null;
}

const TEMPLATE = `# Heartbeat

## Checks to perform every 30 minutes

- [ ] Check email for urgent messages
- [ ] Review calendar for events in next 2 hours
- [ ] Check weather for significant changes
- [ ] Review pending tasks
- [ ] If idle for 8+ hours, send brief check-in

## Notes

- Only alert if something actually needs attention
- Use \`HEARTBEAT_OK\` if everything is fine
- Be smart about prioritization
`;

export function HeartbeatStatus({ data, onSave }: HeartbeatStatusProps) {
  const { t } = useI18n();
  
  // Editor state
  const [isEditing, setIsEditing] = useState(!data.configured);
  const [content, setContent] = useState(data.heartbeatMd);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Agent selection for HEARTBEAT.md editing
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // Agent heartbeat config editing state
  const [editingConfigAgent, setEditingConfigAgent] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ every: string; target: string }>({
    every: "15m",
    target: "none",
  });
  const [isSavingAgent, setIsSavingAgent] = useState<string | null>(null);

  // Load HEARTBEAT.md for selected agent
  useEffect(() => {
    if (selectedAgentId) {
      loadAgentHeartbeatMd(selectedAgentId);
    } else {
      setContent(data.heartbeatMd);
    }
  }, [selectedAgentId, data.heartbeatMd]);

  const loadAgentHeartbeatMd = async (agentId: string) => {
    setIsLoadingContent(true);
    try {
      const res = await fetch(`/api/heartbeat?agentId=${encodeURIComponent(agentId)}`);
      if (res.ok) {
        const json = await res.json();
        setContent(json.heartbeatMd || "");
      }
    } catch (e) {
      console.error("Failed to load agent HEARTBEAT.md:", e);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await onSave(content, selectedAgentId || undefined);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditConfig = (agent: AgentHeartbeat) => {
    setEditingConfigAgent(agent.agentId);
    setEditForm({
      every: agent.every,
      target: agent.target,
    });
  };

  const cancelEditConfig = () => {
    setEditingConfigAgent(null);
    setEditForm({ every: "15m", target: "none" });
  };

  const saveAgentConfig = async (agentId: string) => {
    setIsSavingAgent(agentId);
    try {
      const res = await fetch(`/api/heartbeat/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        // Update local state
        if (data.agentHeartbeats) {
          const updated = data.agentHeartbeats.map((a) =>
            a.agentId === agentId
              ? { ...a, every: editForm.every, target: editForm.target }
              : a
          );
          data.agentHeartbeats = updated;
        }
        setEditingConfigAgent(null);
      }
    } catch (e) {
      console.error("Failed to save agent config:", e);
    } finally {
      setIsSavingAgent(null);
    }
  };

  const selectAgentForEdit = (agentId: string | null) => {
    setSelectedAgentId(agentId);
    setIsEditing(false);
  };

  const useTemplate = () => {
    setContent(TEMPLATE);
    setIsEditing(true);
  };

  const getSelectedAgentName = () => {
    if (!selectedAgentId || !data.agentHeartbeats) return null;
    const agent = data.agentHeartbeats.find((a) => a.agentId === selectedAgentId);
    return agent?.agentName || selectedAgentId;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Agent Heartbeats List */}
      {data.agentHeartbeats && data.agentHeartbeats.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
          }}
        >
          <h3
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "1rem",
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
            }}
          >
            <Heart className="w-5 h-5" style={{ color: "var(--error)" }} />
            {t("heartbeat.agentHeartbeatsTitle")}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {data.agentHeartbeats.map((agent) => (
              <div
                key={agent.agentId}
                style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: selectedAgentId === agent.agentId ? "var(--accent)" : "var(--card-elevated)",
                  borderRadius: "0.5rem",
                  border: selectedAgentId === agent.agentId ? "2px solid var(--accent)" : editingConfigAgent === agent.agentId ? "2px solid var(--info)" : "1px solid var(--border)",
                  cursor: "pointer",
                }}
                onClick={() => selectAgentForEdit(agent.agentId)}
              >
                {editingConfigAgent === agent.agentId ? (
                  // Config edit mode
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: agent.enabled ? "var(--success)" : "var(--text-muted)",
                        }}
                      />
                      <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                        {agent.agentName}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <label style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {t("heartbeat.interval")}
                        </label>
                        <select
                          value={editForm.every}
                          onChange={(e) => setEditForm((f) => ({ ...f, every: e.target.value }))}
                          style={{
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--text-primary)",
                            fontSize: "0.85rem",
                          }}
                        >
                          <option value="1m">1m</option>
                          <option value="5m">5m</option>
                          <option value="15m">15m</option>
                          <option value="30m">30m</option>
                          <option value="1h">1h</option>
                          <option value="2h">2h</option>
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <label style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
                          {t("heartbeat.target")}
                        </label>
                        <select
                          value={editForm.target}
                          onChange={(e) => setEditForm((f) => ({ ...f, target: e.target.value }))}
                          style={{
                            padding: "0.5rem",
                            borderRadius: "0.375rem",
                            border: "1px solid var(--border)",
                            backgroundColor: "var(--card)",
                            color: "var(--text-primary)",
                            fontSize: "0.85rem",
                          }}
                        >
                          <option value="none">none</option>
                          <option value="last">last</option>
                          <option value="all">all</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                      <button
                        onClick={cancelEditConfig}
                        style={{
                          padding: "0.4rem 0.75rem",
                          borderRadius: "0.375rem",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--card)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                      >
                        {t("common.cancel")}
                      </button>
                      <button
                        onClick={() => saveAgentConfig(agent.agentId)}
                        disabled={isSavingAgent === agent.agentId}
                        style={{
                          padding: "0.4rem 0.75rem",
                          borderRadius: "0.375rem",
                          border: "none",
                          backgroundColor: "var(--success)",
                          color: "#000",
                          cursor: isSavingAgent === agent.agentId ? "not-allowed" : "pointer",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          opacity: isSavingAgent === agent.agentId ? 0.7 : 1,
                        }}
                      >
                        {isSavingAgent === agent.agentId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {t("common.save")}
                      </button>
                    </div>
                  </div>
                ) : (
                  // View mode
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: agent.enabled ? "var(--success)" : "var(--text-muted)",
                        }}
                      />
                      <User className="w-4 h-4" style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--text-secondary)" }} />
                      <span style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--text-primary)", fontWeight: 500 }}>
                        {agent.agentName}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock className="w-3.5 h-3.5" style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--info)" }} />
                        <span style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {t("heartbeat.every", { interval: agent.every })}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Target className="w-3.5 h-3.5" style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--accent)" }} />
                        <span style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--text-secondary)", fontSize: "0.8rem" }}>
                          {agent.target}
                        </span>
                      </div>
                      {agent.activeHours && (
                        <span style={{ color: selectedAgentId === agent.agentId ? "#000" : "var(--text-muted)", fontSize: "0.75rem" }}>
                          {agent.activeHours.start} - {agent.activeHours.end}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditConfig(agent);
                        }}
                        style={{
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.25rem",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--card)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        {t("common.edit")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HEARTBEAT.md Editor */}
      <div
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            borderBottom: "1px solid var(--border)",
            backgroundColor: "var(--card-elevated)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            <FileText className="w-4 h-4" />
            {selectedAgentId ? (
              <>
                {t("heartbeat.editor.title")} — <span style={{ color: "var(--accent)" }}>{getSelectedAgentName()}</span>
              </>
            ) : (
              t("heartbeat.editor.title")
            )}
          </span>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {selectedAgentId && (
              <button
                onClick={() => selectAgentForEdit(null)}
                style={{
                  padding: "0.25rem 0.5rem",
                  borderRadius: "0.25rem",
                  backgroundColor: "var(--card)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                {t("common.clear")}
              </button>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: isEditing ? "var(--accent)" : "var(--card)",
                color: isEditing ? "#000" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                fontSize: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              {isEditing ? (
                <>
                  <Eye className="w-3.5 h-3.5" /> {t("heartbeat.editor.preview")}
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" /> {t("heartbeat.editor.edit")}
                </>
              )}
            </button>
          </div>
        </div>

        <div style={{ padding: "1rem" }}>
          {isLoadingContent ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : !content && !isEditing ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p
                style={{
                  color: "var(--text-muted)",
                  marginBottom: "1rem",
                }}
              >
                {t("heartbeat.editor.noFile")}
              </p>
              <button
                onClick={useTemplate}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--accent)",
                  color: "#000",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {t("heartbeat.editor.useTemplate")}
              </button>
            </div>
          ) : (
            <>
              {isEditing ? (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={TEMPLATE}
                  style={{
                    width: "100%",
                    minHeight: "300px",
                    backgroundColor: "var(--card-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: "0.5rem",
                    padding: "1rem",
                    color: "var(--text-primary)",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: "300px",
                    padding: "1rem",
                    backgroundColor: "var(--card-elevated)",
                    borderRadius: "0.5rem",
                    color: "var(--text-secondary)",
                    fontSize: "0.85rem",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                  }}
                >
                  {content || TEMPLATE}
                </div>
              )}

              {isEditing && (
                <div
                  style={{
                    marginTop: "1rem",
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {saveSuccess && (
                    <span
                      style={{
                        color: "var(--success)",
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" /> {t("heartbeat.editor.saved")}
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "var(--success)",
                      color: "#000",
                      border: "none",
                      borderRadius: "0.5rem",
                      cursor: isSaving ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      opacity: isSaving ? 0.7 : 1,
                    }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> {t("heartbeat.saving")}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> {t("common.save")}
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
