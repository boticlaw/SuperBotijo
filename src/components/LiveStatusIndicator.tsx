"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useActivityStream } from "@/hooks/useActivityStream";

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  status: string;
}

export function LiveStatusIndicator() {
  const { activities, isConnected } = useActivityStream({ enabled: true });
  const [recentActivity, setRecentActivity] = useState<Activity | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    if (activities.length === 0) return;

    const latestActivity = activities[0];
    const activityTime = new Date(latestActivity.timestamp).getTime();
    const now = Date.now();
    const isRecent = now - activityTime < 5000;

    if (
      isRecent &&
      (latestActivity.status === "pending" || latestActivity.status === "running")
    ) {
      // setState is intentional here - we're responding to new activity
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecentActivity(latestActivity);
       
      setShowIndicator(true);

      const timeout = setTimeout(() => {
        setShowIndicator(false);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [activities]);

  if (!showIndicator || !isConnected || !recentActivity) return null;

  const description =
    recentActivity.description?.length > 50
      ? recentActivity.description.substring(0, 50) + "..."
      : recentActivity.description;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        border: "1px solid rgba(59, 130, 246, 0.3)",
      }}
    >
      <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#3b82f6" }} />
      <span className="text-sm animate-pulse" style={{ color: "var(--text-primary)" }}>
        {description || "SuperBotijo está trabajando..."}
      </span>
    </div>
  );
}
