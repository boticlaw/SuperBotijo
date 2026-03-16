"use client";

import { MessagesSquare } from "lucide-react";

import { AgentChatPanel } from "@/components/AgentChatPanel";
import { PageHeader } from "@/components/PageHeader";
import { useI18n } from "@/i18n/provider";

export default function ChatPage() {
  const { t } = useI18n();

  return (
    <div className="p-4 md:p-8">
      <PageHeader
        title={t("chat.title")}
        subtitle={t("chat.subtitle")}
        icon={<MessagesSquare className="w-8 h-8" />}
        helpTitle={t("help.chat.title")}
        helpDescription={t("help.chat.description")}
      />

      <AgentChatPanel />
    </div>
  );
}
