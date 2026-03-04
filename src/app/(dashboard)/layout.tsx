"use client";

import { Dock, TopBar, StatusBar } from "@/components/SuperBotijo";
import { I18nProvider } from "@/i18n/provider";
import { CommandPalette } from "@/components/CommandPalette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <I18nProvider>
      <div className="superbotijo-shell" style={{ minHeight: "100vh" }}>
        <Dock />
        <TopBar />

        <main
          style={{
            marginLeft: "68px", // Width of dock
            marginTop: "48px", // Height of top bar
            marginBottom: "32px", // Height of status bar
            minHeight: "calc(100vh - 48px - 32px)",
            padding: "24px",
          }}
        >
          {children}
        </main>

        <StatusBar />

        {/* Command Palette - Global Cmd+K */}
        <CommandPalette />
      </div>
    </I18nProvider>
  );
}
