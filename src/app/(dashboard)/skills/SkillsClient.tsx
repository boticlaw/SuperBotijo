"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Puzzle,
  Package,
  FolderOpen,
  ExternalLink,
  FileText,
  X,
  Power,
  Download,
  Cloud,
} from "lucide-react";
import { SectionHeader, MetricCard } from "@/components/SuperBotijo";
import { ClawHubBrowser } from "@/components/ClawHubBrowser";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useI18n } from "@/i18n/provider";

export interface Skill {
  id: string;
  name: string;
  description: string;
  location: string;
  source: "workspace" | "system";
  workspace?: string;
  homepage?: string;
  emoji?: string;
  fileCount: number;
  fullContent: string;
  files: string[];
  agents: string[];
  enabled: boolean;
}

export interface SkillsInitialData {
  skills: Skill[];
}

export default function SkillsClient({ initialData }: { initialData: SkillsInitialData }) {
  const { t } = useI18n();
  const [skills, setSkills] = useState<Skill[]>(initialData.skills);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSource, setFilterSource] = useState<"all" | "workspace" | "system">("all");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [togglingSkill, setTogglingSkill] = useState<string | null>(null);
  const [showClawHub, setShowClawHub] = useState(false);
  const [updates, setUpdates] = useState<Array<{
    slug: string;
    currentVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
  }>>([]);
  const [skillToDisable, setSkillToDisable] = useState<Skill | null>(null);
  const [showUpdateAllConfirm, setShowUpdateAllConfirm] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  useEffect(() => {
    fetch("/api/skills/updates")
      .then((res) => res.json())
      .then((data) => {
        if (data.updates) {
          setUpdates(data.updates);
        }
      })
      .catch(() => {});
  }, []);

  const handleInstallFromClawHub = () => {
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data) => {
        if (data.skills) {
          setSkills(data.skills);
        }
      })
      .catch(() => {});
    fetch("/api/skills/updates")
      .then((res) => res.json())
      .then((data) => {
        if (data.updates) {
          setUpdates(data.updates);
        }
      })
      .catch(() => {});
    setShowClawHub(false);
  };

  const handleToggleSkill = async (skillId: string, currentlyEnabled: boolean) => {
    const skill = skills.find(s => s.id === skillId);
    if (currentlyEnabled && skill) {
      setSkillToDisable(skill);
      return;
    }

    await executeToggleSkill(skillId, currentlyEnabled);
  };

  const executeToggleSkill = async (skillId: string, currentlyEnabled: boolean) => {
    setTogglingSkill(skillId);
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillId)}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      });

      if (res.ok) {
        setSkills((prev) =>
          prev.map((s) =>
            s.id === skillId ? { ...s, enabled: !currentlyEnabled } : s
          )
        );
        if (selectedSkill?.id === skillId) {
          setSelectedSkill((prev) => (prev ? { ...prev, enabled: !currentlyEnabled } : null));
        }
      }
    } catch (error) {
      console.error("Failed to toggle skill:", error);
    } finally {
      setTogglingSkill(null);
      setSkillToDisable(null);
    }
  };

  const handleConfirmDisable = () => {
    if (skillToDisable) {
      executeToggleSkill(skillToDisable.id, true);
    }
  };

  const handleUpdateAll = async () => {
    setIsUpdatingAll(true);
    for (const update of updates.filter(u => u.hasUpdate)) {
      try {
        await fetch(`/api/skills/${encodeURIComponent(update.slug)}/update`, {
          method: "POST",
        });
      } catch (err) {
        console.error(`Failed to update ${update.slug}:`, err);
      }
    }
    setIsUpdatingAll(false);
    setShowUpdateAllConfirm(false);
    window.location.reload();
  };

  let filteredSkills = skills;

  if (filterSource !== "all") {
    filteredSkills = filteredSkills.filter((s) => s.source === filterSource);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredSkills = filteredSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.id.toLowerCase().includes(query)
    );
  }

  const workspaceSkills = filteredSkills.filter((s) => s.source === "workspace");
  const systemSkills = filteredSkills.filter((s) => s.source === "system");

  const workspaceCount = skills.filter((s) => s.source === "workspace").length;
  const systemCount = skills.filter((s) => s.source === "system").length;

  return (
    <div style={{ padding: "24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "24px",
            fontWeight: 700,
            letterSpacing: "-1px",
            color: "var(--text-primary)",
            marginBottom: "4px",
          }}
        >
          Skills Manager
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "13px",
            color: "var(--text-secondary)",
          }}
        >
          Skills disponibles en el sistema OpenClaw
        </p>
        
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowClawHub(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            <Cloud className="w-4 h-4" />
            Browse ClawHub
          </button>
          
          {updates.filter(u => u.hasUpdate).length > 0 && (
            <button
              onClick={() => setShowUpdateAllConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: "var(--warning)",
                color: "white",
              }}
            >
              <Download className="w-4 h-4" />
              {t("skills.updateAll", { count: updates.filter(u => u.hasUpdate).length })}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <MetricCard icon={Puzzle} value={skills.length} label="Total Skills" />
        <MetricCard
          icon={FolderOpen}
          value={workspaceCount}
          label="Workspace Skills"
          changeColor="positive"
        />
        <MetricCard
          icon={Package}
          value={systemCount}
          label="System Skills"
          changeColor="secondary"
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "16px",
              height: "16px",
              color: "var(--text-muted)",
            }}
          />
          <input
            type="text"
            placeholder="Buscar skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "40px",
              paddingRight: "16px",
              paddingTop: "12px",
              paddingBottom: "12px",
              borderRadius: "6px",
              backgroundColor: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setFilterSource("all")}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              backgroundColor: filterSource === "all" ? "var(--accent-soft)" : "var(--surface)",
              color: filterSource === "all" ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Todas ({skills.length})
          </button>
          <button
            onClick={() => setFilterSource("workspace")}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              backgroundColor: filterSource === "workspace" ? "var(--accent-soft)" : "var(--surface)",
              color: filterSource === "workspace" ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            Workspace ({workspaceCount})
          </button>
          <button
            onClick={() => setFilterSource("system")}
            style={{
              padding: "12px 20px",
              borderRadius: "6px",
              backgroundColor: filterSource === "system" ? "var(--accent-soft)" : "var(--surface)",
              color: filterSource === "system" ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            System ({systemCount})
          </button>
        </div>
      </div>

      {filteredSkills.length === 0 ? (
        <div
          style={{
            backgroundColor: "var(--surface)",
            borderRadius: "12px",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <Puzzle
            style={{
              width: "48px",
              height: "48px",
              color: "var(--text-muted)",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "var(--text-secondary)" }}>No se encontraron skills</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          {workspaceSkills.length > 0 && (filterSource === "all" || filterSource === "workspace") && (
            <div>
              <SectionHeader label="WORKSPACE SKILLS" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                {workspaceSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onClick={() => setSelectedSkill(skill)}
                    onToggle={() => handleToggleSkill(skill.id, skill.enabled)}
                    isToggling={togglingSkill === skill.id}
                  />
                ))}
              </div>
            </div>
          )}

          {systemSkills.length > 0 && (filterSource === "all" || filterSource === "system") && (
            <div>
              <SectionHeader label="SYSTEM SKILLS" />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "12px",
                  marginTop: "16px",
                }}
              >
                {systemSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onClick={() => setSelectedSkill(skill)}
                    onToggle={() => handleToggleSkill(skill.id, skill.enabled)}
                    isToggling={togglingSkill === skill.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedSkill && (
        <SkillDetailModal
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
          onToggle={() => handleToggleSkill(selectedSkill.id, selectedSkill.enabled)}
          isToggling={togglingSkill === selectedSkill.id}
        />
      )}

      {showClawHub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => setShowClawHub(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <ClawHubBrowser
              onInstall={handleInstallFromClawHub}
              onClose={() => setShowClawHub(false)}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={skillToDisable !== null}
        title={t("skills.disableTitle")}
        message={t("skills.disableSkill", { name: skillToDisable?.name || "" })}
        confirmLabel={t("skills.disable")}
        cancelLabel={t("common.cancel")}
        variant="warning"
        isLoading={togglingSkill === skillToDisable?.id}
        onConfirm={handleConfirmDisable}
        onCancel={() => setSkillToDisable(null)}
      />

      <ConfirmDialog
        isOpen={showUpdateAllConfirm}
        title={t("skills.updateAllTitle")}
        message={t("skills.updateAllConfirm", { count: updates.filter(u => u.hasUpdate).length })}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        variant="info"
        isLoading={isUpdatingAll}
        onConfirm={handleUpdateAll}
        onCancel={() => setShowUpdateAllConfirm(false)}
      />
    </div>
  );
}

function SkillCard({
  skill,
  onClick,
  onToggle,
  isToggling,
}: {
  skill: Skill;
  onClick: () => void;
  onToggle: () => void;
  isToggling: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--surface)",
        borderRadius: "8px",
        padding: "16px",
        border: "1px solid var(--border)",
        cursor: "pointer",
        transition: "all 150ms ease",
        opacity: skill.enabled ? 1 : 0.6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface-hover)";
        e.currentTarget.style.borderColor = "var(--border-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
      onClick={onClick}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        {skill.emoji && <span style={{ fontSize: "24px", flexShrink: 0 }}>{skill.emoji}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "4px",
            }}
          >
            {skill.name}
          </h3>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {skill.description}
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: "12px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <div
            style={{
              backgroundColor:
                skill.source === "workspace" ? "var(--accent-soft)" : "var(--surface-elevated)",
              color: skill.source === "workspace" ? "var(--accent)" : "var(--text-muted)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontFamily: "var(--font-body)",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {skill.source === "system" ? "system" : (skill.workspace || "workspace")}
          </div>
          {!skill.enabled && (
            <div
              style={{
                backgroundColor: "var(--surface-elevated)",
                color: "var(--text-muted)",
                padding: "3px 8px",
                borderRadius: "4px",
                fontFamily: "var(--font-body)",
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
                border: "1px solid var(--border)",
              }}
            >
              DISABLED
            </div>
          )}
          {skill.agents &&
            skill.agents.length > 0 &&
            skill.agents.map((agent) => (
              <div
                key={agent}
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  color: "var(--text-secondary)",
                  padding: "3px 7px",
                  borderRadius: "4px",
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                }}
              >
                {agent}
              </div>
            ))}
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "10px",
              color: "var(--text-muted)",
            }}
          >
            {skill.fileCount} files
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {skill.homepage && <ExternalLink style={{ width: "14px", height: "14px", color: "var(--text-muted)" }} />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            disabled={isToggling}
            title={skill.enabled ? "Disable skill" : "Enable skill"}
            style={{
              width: "36px",
              height: "20px",
              borderRadius: "10px",
              backgroundColor: skill.enabled ? "var(--accent)" : "var(--text-muted)",
              border: "none",
              cursor: isToggling ? "wait" : "pointer",
              position: "relative",
              transition: "background-color 200ms",
              opacity: isToggling ? 0.5 : 1,
            }}
          >
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                backgroundColor: "white",
                position: "absolute",
                top: "2px",
                left: skill.enabled ? "18px" : "2px",
                transition: "left 200ms",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillDetailModal({
  skill,
  onClose,
  onToggle,
  isToggling,
}: {
  skill: Skill;
  onClose: () => void;
  onToggle: () => void;
  isToggling: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderRadius: "12px",
          maxWidth: "800px",
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid var(--border)",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              padding: "8px",
              borderRadius: "6px",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X style={{ width: "20px", height: "20px" }} />
          </button>

          <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", paddingRight: "40px" }}>
            {skill.emoji && <span style={{ fontSize: "48px" }}>{skill.emoji}</span>}
            <div style={{ flex: 1 }}>
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "8px",
                }}
              >
                {skill.name}
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  marginBottom: "12px",
                }}
              >
                {skill.description}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <div className="badge-positive">{skill.source === "system" ? "system" : (skill.workspace || "workspace")}</div>
                <div className="badge-info">{skill.fileCount} archivos</div>
                {!skill.enabled && (
                  <div
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.1)",
                      color: "#ef4444",
                      padding: "3px 10px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    DISABLED
                  </div>
                )}
                {skill.agents &&
                  skill.agents.length > 0 &&
                  skill.agents.map((agent) => (
                    <div
                      key={agent}
                      style={{
                        backgroundColor: "var(--surface-elevated)",
                        color: "var(--text-secondary)",
                        padding: "3px 10px",
                        borderRadius: "4px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        fontWeight: 600,
                        border: "1px solid var(--border)",
                      }}
                    >
                      @{agent}
                    </div>
                  ))}
                {skill.homepage && (
                  <a
                    href={skill.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      color: "var(--accent)",
                      fontSize: "12px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Homepage <ExternalLink style={{ width: "12px", height: "12px" }} />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "16px",
              padding: "12px 16px",
              backgroundColor: "var(--surface-elevated)",
              borderRadius: "8px",
            }}
          >
            <Power style={{ width: "18px", height: "18px", color: skill.enabled ? "var(--accent)" : "var(--text-muted)" }} />
            <span style={{ flex: 1, color: "var(--text-primary)", fontSize: "14px" }}>
              {skill.enabled ? "Skill is enabled" : "Skill is disabled"}
            </span>
            <button
              onClick={onToggle}
              disabled={isToggling}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                backgroundColor: skill.enabled ? "rgba(239, 68, 68, 0.1)" : "var(--accent)",
                color: skill.enabled ? "#ef4444" : "white",
                border: "none",
                cursor: isToggling ? "wait" : "pointer",
                fontSize: "12px",
                fontWeight: 600,
                opacity: isToggling ? 0.5 : 1,
              }}
            >
              {isToggling ? "..." : skill.enabled ? "Disable" : "Enable"}
            </button>
          </div>
        </div>

        <div style={{ padding: "24px" }}>
          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: "12px",
            }}
          >
            Archivos ({skill.files.length})
          </h3>
          <div
            style={{
              backgroundColor: "var(--bg)",
              borderRadius: "8px",
              padding: "16px",
              maxHeight: "400px",
              overflow: "auto",
            }}
          >
            {skill.files.map((file) => (
              <div
                key={file}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  padding: "4px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <FileText style={{ width: "14px", height: "14px", color: "var(--text-muted)", flexShrink: 0 }} />
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
