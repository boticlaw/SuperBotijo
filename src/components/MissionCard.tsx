"use client";

import { Target, Edit3 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { HelpTooltip } from "@/components/HelpTooltip";
import type { Mission } from "@/lib/mission-types";

interface MissionCardProps {
  mission: Mission | null;
  onEdit: () => void;
}

export function MissionCard({ mission, onEdit }: MissionCardProps) {
  const { t } = useI18n();

  // Handle empty/null mission gracefully
  if (!mission) {
    return (
      <div
        className="rounded-xl p-5"
        style={{
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="accent-line" />
            <h3
              className="text-base font-semibold"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
              }}
            >
              <Target className="inline-block w-5 h-5 mr-2 mb-0.5" />
              {t("mission.title")}
            </h3>
            <HelpTooltip
              title={t("help.mission.title")}
              description={t("help.mission.description")}
              position="right"
            />
          </div>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            {t("mission.defineMission")}
          </button>
        </div>
        <p
          className="text-sm italic"
          style={{ color: "var(--text-muted)" }}
        >
          {t("mission.noMissionDefined")}
        </p>
      </div>
    );
  }

  // Show max 5 goals with "more..." indicator
  const visibleGoals = mission.goals.slice(0, 5);
  const hasMoreGoals = mission.goals.length > 5;

  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="accent-line" />
          <h3
            className="text-base font-semibold"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
            }}
          >
            <Target className="inline-block w-5 h-5 mr-2 mb-0.5" />
            {t("mission.title")}
          </h3>
          <HelpTooltip
            title={t("help.mission.title")}
            description={t("help.mission.description")}
            position="right"
          />
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
          style={{
            backgroundColor: "var(--card-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <Edit3 className="h-3.5 w-3.5" />
          {t("common.edit")}
        </button>
      </div>

      {/* Mission Statement */}
      <p
        className="text-sm mb-4 leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        {mission.statement}
      </p>

      {/* Goals */}
      {visibleGoals.length > 0 && (
        <div className="mb-4">
          <h4
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {t("mission.goals")}
          </h4>
          <ul className="space-y-1.5">
            {visibleGoals.map((goal, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
                <span className="line-clamp-1">{goal}</span>
              </li>
            ))}
            {hasMoreGoals && (
              <li
                className="text-sm italic pl-3.5"
                style={{ color: "var(--text-muted)" }}
              >
                +{mission.goals.length - 5} {t("mission.more")}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Values as tags */}
      {mission.values.length > 0 && (
        <div>
          <h4
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {t("mission.values")}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {mission.values.map((value, index) => (
              <span
                key={index}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  backgroundColor: "var(--card-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      {mission.lastUpdated && (
        <p
          className="text-xs mt-4 pt-3"
          style={{
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {t("mission.lastUpdated")}: {new Date(mission.lastUpdated).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}