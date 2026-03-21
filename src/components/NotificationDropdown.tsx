"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Trash2, X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export interface Notification {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  link?: string;
  metadata?: Record<string, unknown>;
}

const typeConfig: Record<
  Notification["type"],
  {
    icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    colorVar: string;
    bgVar: string;
  }
> = {
  info: {
    icon: Info,
    colorVar: "#60a5fa",
    bgVar: "rgba(59, 130, 246, 0.12)",
  },
  success: {
    icon: CheckCircle,
    colorVar: "#4ade80",
    bgVar: "rgba(74, 222, 128, 0.12)",
  },
  warning: {
    icon: AlertTriangle,
    colorVar: "#fbbf24",
    bgVar: "rgba(251, 191, 36, 0.12)",
  },
  error: {
    icon: XCircle,
    colorVar: "#f87171",
    bgVar: "rgba(248, 113, 113, 0.12)",
  },
};

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, read: true }),
      });
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, {
        method: "DELETE",
      });
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const clearRead = async () => {
    try {
      await fetch("/api/notifications?action=clearRead", {
        method: "DELETE",
      });
      await fetchNotifications();
    } catch (error) {
      console.error("Failed to clear read notifications:", error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: isOpen ? "var(--surface-elevated)" : "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = "var(--surface-hover, rgba(255,255,255,0.05))";
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              backgroundColor: "#f87171",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--bg)",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "420px",
            maxHeight: "600px",
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            zIndex: 1000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              backgroundColor: "var(--surface-elevated)",
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "2px",
                }}
              >
                Notifications
              </h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <CheckCheck size={16} />
                </button>
              )}
              {notifications.some((n) => n.read) && (
                <button
                  onClick={clearRead}
                  title="Clear read notifications"
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--surface)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading && notifications.length === 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  color: "var(--text-muted)",
                }}
              >
                Loading...
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                <Bell size={48} style={{ opacity: 0.3, marginBottom: "12px" }} />
                <p style={{ fontSize: "14px" }}>No notifications yet</p>
              </div>
            )}

            {notifications.map((notification, index) => {
              const config = typeConfig[notification.type];
              const Icon = config.icon;

              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "16px 20px",
                    borderBottom: index < notifications.length - 1 ? "1px solid var(--border)" : "none",
                    backgroundColor: notification.read ? "transparent" : "rgba(96, 165, 250, 0.05)",
                    cursor: notification.link ? "pointer" : "default",
                    transition: "background-color 0.2s",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (notification.link) {
                      e.currentTarget.style.backgroundColor = "var(--surface-hover, rgba(255,255,255,0.03))";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = notification.read
                      ? "transparent"
                      : "rgba(96, 165, 250, 0.05)";
                  }}
                >
                  {/* Type Icon */}
                  <div
                    style={{
                      padding: "8px",
                      borderRadius: "8px",
                      backgroundColor: config.bgVar,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "fit-content",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} style={{ color: config.colorVar }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
                      <h4
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "2px",
                        }}
                      >
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: "#60a5fa",
                            flexShrink: 0,
                            marginLeft: "8px",
                          }}
                        />
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        lineHeight: "1.5",
                        marginBottom: "6px",
                      }}
                    >
                      {notification.message}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                      </span>

                      {/* Action Buttons */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        {!notification.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            title="Mark as read"
                            style={{
                              padding: "4px",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: "transparent",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--surface)";
                              e.currentTarget.style.color = "#4ade80";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          title="Delete"
                          style={{
                            padding: "4px",
                            borderRadius: "4px",
                            border: "none",
                            backgroundColor: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = "var(--surface)";
                            e.currentTarget.style.color = "#f87171";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "var(--text-muted)";
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
