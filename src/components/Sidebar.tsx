"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Timer,
  Brain,
  BarChart3,
  FileBarChart,
  Puzzle,
  FolderOpen,
  Terminal,
  LogOut,
  Settings,
  User,
  Menu,
  X,
  Users,
  Gamepad2,
  Zap,
  Server,
  GitFork,
  SquareTerminal,
  Bot,
  Calendar,
  Bell,
  LayoutGrid,
  Target,
  BookOpen,
  Briefcase,
} from "lucide-react";
import { getAgentDisplayName } from "@/config/branding";

const navGroups = [
  {
    title: "Main",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agents", label: "Agents", icon: Users },
      { href: "/subagents", label: "Sub-Agents", icon: Bot },
      { href: "/office", label: "🎮 Office", icon: Gamepad2, highlight: true },
    ],
  },
  {
    title: "Mission Control",
    items: [
      { href: "/mission", label: "Mission", icon: Target },
      { href: "/kanban", label: "Kanban", icon: LayoutGrid },
      { href: "/projects", label: "Projects", icon: Briefcase },
      { href: "/journal", label: "Journal", icon: BookOpen },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/memory", label: "Memory", icon: Brain },
      { href: "/files", label: "Files", icon: FolderOpen },
      { href: "/sessions", label: "Sessions", icon: Timer },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    title: "Tools",
    items: [
      { href: "/terminal", label: "Terminal", icon: SquareTerminal },
      { href: "/git", label: "Git", icon: GitFork },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/system", label: "System", icon: Server },
      { href: "/skills", label: "Skills", icon: Puzzle },
      { href: "/cron", label: "Cron Jobs", icon: Zap },
      { href: "/logs", label: "Logs", icon: Terminal },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isMobile]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  return (
    <>
      <button
        onClick={toggleSidebar}
        className="mobile-menu-button"
        aria-label="Toggle menu"
        style={{
          position: "fixed",
          top: "1rem",
          left: "1rem",
          zIndex: 60,
          padding: "0.5rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--card)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          display: isMobile ? "flex" : "none",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <Menu className="w-6 h-6" />
      </button>

      {isMobile && (
        <div
          onClick={closeSidebar}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 40,
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? "auto" : "none",
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      <aside
        className="sidebar"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: "16rem",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "1rem",
          backgroundColor: "var(--card)",
          borderRight: "1px solid var(--border)",
          zIndex: 50,
          transform: isMobile ? (isOpen ? "translateX(0)" : "translateX(-100%)") : "translateX(0)",
          transition: "transform 0.3s ease",
          overflowY: "auto",
        }}
      >
        {isMobile && (
          <button
            onClick={closeSidebar}
            aria-label="Close menu"
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              padding: "0.25rem",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
          <Terminal className="w-6 h-6" style={{ color: "var(--accent)" }} />
          <h1
            className="text-base font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
            }}
          >
            SuperBotijo
          </h1>
        </div>

        <nav className="flex-1 py-2">
          {navGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: "12px" }}>
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: "var(--text-muted)",
                  padding: "8px 16px 4px",
                }}
              >
                {group.title}
              </div>
              <ul>
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={closeSidebar}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          transition: "all 0.15s ease",
                          color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                          backgroundColor: isActive
                            ? "var(--accent)"
                            : item.highlight
                            ? "linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1))"
                            : "transparent",
                          fontWeight: isActive ? 600 : 400,
                          borderLeft: item.highlight && !isActive ? "3px solid var(--accent)" : "none",
                        }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{
                            color: isActive
                              ? "var(--text-primary)"
                              : item.highlight
                              ? "var(--accent)"
                              : "var(--text-muted)",
                          }}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="pt-4 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <Link
            href="/settings"
            onClick={closeSidebar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              color: pathname === "/settings" ? "var(--text-primary)" : "var(--text-secondary)",
              backgroundColor: pathname === "/settings" ? "var(--accent)" : "transparent",
              fontWeight: pathname === "/settings" ? 600 : 400,
              marginBottom: "8px",
            }}
          >
            <Settings
              className="w-4 h-4"
              style={{ color: pathname === "/settings" ? "var(--text-primary)" : "var(--text-muted)" }}
            />
            Settings
          </Link>

          <Link
            href="/about"
            onClick={closeSidebar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              color: pathname === "/about" ? "var(--text-primary)" : "var(--text-secondary)",
              backgroundColor: pathname === "/about" ? "var(--accent)" : "transparent",
              fontWeight: pathname === "/about" ? 600 : 400,
              marginBottom: "8px",
            }}
          >
            <User
              className="w-4 h-4"
              style={{ color: pathname === "/about" ? "var(--text-primary)" : "var(--text-muted)" }}
            />
            {getAgentDisplayName()}
          </Link>

          <button
            onClick={handleLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 16px",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text-muted)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
