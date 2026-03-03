"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/i18n/provider";
import {
  Home,
  FolderOpen,
  Brain,
  Bot,
  Building2,
  Activity,
  DollarSign,
  Settings,
  LogOut,
  Users,
  FileBarChart,
  Workflow,
  Beaker,
  SquareTerminal,
  Server,
} from "lucide-react";

function DockItems() {
  const { t } = useI18n();
  
  return [
    { href: "/", labelKey: "dock.dashboard", icon: Home },
    { href: "/agents", labelKey: "dock.agents", icon: Users },
    { href: "/office", labelKey: "dock.office", icon: Building2 },
    { href: "/memory", labelKey: "dock.memory", icon: Brain },
    { href: "/files", labelKey: "dock.files", icon: FolderOpen },
    { href: "/analytics", labelKey: "dock.analytics", icon: DollarSign },
    { href: "/workflows", labelKey: "dock.workflows", icon: Workflow },
    { href: "/terminal", labelKey: "dock.terminal", icon: SquareTerminal },
    { href: "/system", labelKey: "dock.system", icon: Server },
    { href: "/settings", labelKey: "dock.settings", icon: Settings },
  ];
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
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
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
              {t(item.labelKey)}
            </span>
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
