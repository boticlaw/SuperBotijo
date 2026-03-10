"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import {
  Home,
  FolderOpen,
  Brain,
  DollarSign,
  Settings,
  LogOut,
  Users,
  SquareTerminal,
  Server,
  LayoutGrid,
  Box,
} from "lucide-react";

interface DockItem {
  href: string;
  labelKey: string;
  helpKey: string;
  icon: typeof Home;
}

function DockItems(): DockItem[] {
  return [
    { href: "/", labelKey: "dock.dashboard", helpKey: "help.dashboard", icon: Home },
    { href: "/agents", labelKey: "dock.agents", helpKey: "help.agents", icon: Users },
    { href: "/office", labelKey: "dock.office", helpKey: "help.office", icon: Box },
    { href: "/kanban", labelKey: "dock.kanban", helpKey: "help.kanban", icon: LayoutGrid },
    { href: "/memory", labelKey: "dock.memory", helpKey: "help.memory", icon: Brain },
    { href: "/files", labelKey: "dock.files", helpKey: "help.files", icon: FolderOpen },
    { href: "/analytics", labelKey: "dock.analytics", helpKey: "help.analytics", icon: DollarSign },
    { href: "/terminal", labelKey: "dock.terminal", helpKey: "help.terminal", icon: SquareTerminal },
    { href: "/system", labelKey: "dock.system", helpKey: "help.system", icon: Server },
    { href: "/settings", labelKey: "dock.settings", helpKey: "help.settings", icon: Settings },
  ];
}

interface DockItemTooltipProps {
  title: string;
  description: string;
  isActive: boolean;
}

function DockItemTooltip({ title, description, isActive }: DockItemTooltipProps) {
  return (
    <div
      className="dock-tooltip"
      style={{
        position: "absolute",
        left: "72px",
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 100,
        pointerEvents: "none",
        opacity: 0,
        transition: "opacity 150ms ease",
      }}
    >
      {/* Arrow */}
      <div
        style={{
          position: "absolute",
          left: "-6px",
          top: "50%",
          transform: "translateY(-50%)",
          width: 0,
          height: 0,
          borderStyle: "solid",
          borderWidth: "6px 6px 6px 0",
          borderColor: "transparent var(--surface-elevated) transparent transparent",
        }}
      />
      
      <div
        style={{
          backgroundColor: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "10px 14px",
          minWidth: "200px",
          maxWidth: "260px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: isActive ? "var(--accent)" : "var(--text-primary)",
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          {isActive && (
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--accent)",
              }}
            />
          )}
          {title}
        </div>
        <div
          style={{
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--text-secondary)",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

export function Dock() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const dockItems = DockItems();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className="dock"
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: "68px",
        backgroundColor: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 6px",
        gap: "4px",
        zIndex: 50,
        overflowY: "auto",
      }}
    >
      {dockItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = item.icon;
        const title = t(`${item.helpKey}.title`);
        const description = t(`${item.helpKey}.description`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className="dock-item group relative"
            style={{
              width: "56px",
              height: "56px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              borderRadius: "8px",
              backgroundColor: isActive ? "var(--accent-soft)" : "transparent",
              transition: "all 150ms ease",
              position: "relative",
              textDecoration: "none",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              }
              const tooltip = e.currentTarget.querySelector(".dock-tooltip") as HTMLElement;
              if (tooltip) tooltip.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
              const tooltip = e.currentTarget.querySelector(".dock-tooltip") as HTMLElement;
              if (tooltip) tooltip.style.opacity = "0";
            }}
          >
            <Icon
              style={{
                width: "22px",
                height: "22px",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                strokeWidth: isActive ? 2.5 : 2,
              }}
            />

            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "9px",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--accent)" : "var(--text-muted)",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "52px",
              }}
            >
              {t(item.labelKey).split(" ")[0]}
            </span>

            <DockItemTooltip title={title} description={description} isActive={isActive} />
          </Link>
        );
      })}

      <button
        type="button"
        onClick={handleLogout}
        className="group relative"
        aria-label={t("dock.logout")}
        title={t("dock.logout")}
        data-testid="logout-button"
        style={{
          marginTop: "auto",
          width: "56px",
          height: "56px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "8px",
          backgroundColor: "transparent",
          color: "var(--text-secondary)",
          transition: "all 150ms ease",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--error)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
      >
        <LogOut style={{ width: "22px", height: "22px" }} />
        <span
          className="absolute left-[72px] top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg text-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          {t("dock.logout")}
        </span>
      </button>
    </aside>
  );
}
