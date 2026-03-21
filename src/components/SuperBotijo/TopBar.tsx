"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { LiveStatusIndicator } from "@/components/LiveStatusIndicator";
import { GatewayStatusBadge } from "@/components/GatewayStatusBadge";
import { BRANDING } from "@/config/branding";
import { useI18n } from "@/i18n/provider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import logoSmall from "@/../public/logo-small.png";

export function TopBar() {
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const displayName = BRANDING.ownerUsername || "Admin";
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!showUserMenu) {
        return;
      }

      const target = event.target as Node;
      if (!userMenuRef.current || !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [showUserMenu]);

  return (
    <>
      <div
        className="top-bar"
        style={{
          position: "fixed",
          top: 0,
          left: "68px",
          right: 0,
          height: "48px",
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          zIndex: 45,
        }}
      >
        <div className="flex items-center gap-3">
          <Image 
            src={logoSmall}
            alt="SuperBotijo"
            width={28}
            height={28}
            style={{ objectFit: "contain" }}
          />
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--text-primary)",
              letterSpacing: "-0.5px",
            }}
          >
            {BRANDING.appTitle}
          </h1>
          <GatewayStatusBadge />
          <LiveStatusIndicator />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 transition-all"
            style={{
              width: "240px",
              height: "32px",
              backgroundColor: "var(--surface-elevated)",
              borderRadius: "6px",
              padding: "0 12px",
            }}
          >
            <Search
              className="flex-shrink-0"
              style={{
                width: "16px",
                height: "16px",
                color: "var(--text-muted)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              {t("topbar.search")}
            </span>
          </button>

          <LanguageSwitcher />

          <NotificationDropdown />

          <div ref={userMenuRef} className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2"
              data-testid="user-menu-button"
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "14px",
                  backgroundColor: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {initial}
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                {displayName}
              </span>
            </button>

            {showUserMenu && (
              <div
                className="absolute right-0 top-full mt-1 z-50"
                style={{
                  backgroundColor: "var(--surface-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  minWidth: "120px",
                  padding: "4px 0",
                }}
              >
                <button
                  onClick={handleLogout}
                  data-testid="logout-button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface)]"
                  style={{
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {t("topbar.logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSearch && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
          }}
          onClick={() => setShowSearch(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "90%",
              maxWidth: "42rem",
            }}
          >
            <GlobalSearch />
          </div>
        </div>
      )}
    </>
  );
}
