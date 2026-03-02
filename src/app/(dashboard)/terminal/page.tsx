"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Send, Trash2, Copy, ChevronRight } from "lucide-react";

interface HistoryEntry {
  command: string;
  output: string;
  error?: string;
  duration?: number;
  ts: Date;
}

const QUICK_COMMANDS = [
  "df -h /",
  "free -h",
  "uptime",
  "ps aux | grep node",
  "systemctl status superbotijo",
  "pm2 list",
  "ls /home/daniel/.openclaw/workspace",
  "git -C /home/daniel/.openclaw/workspace/superbotijo status",
  "journalctl -u superbotijo -n 20 --no-pager",
  "docker ps",
  "netstat -tlnp",
  "cat /proc/loadavg",
];

export default function TerminalPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const runCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setLoading(true);
    setCmdHistory((prev) => [trimmed, ...prev.slice(0, 99)]);
    setCmdHistoryIdx(-1);
    setInput("");

    try {
      const res = await fetch("/api/terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });
      const data = await res.json();

      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: data.output || "",
          error: !res.ok ? data.error : undefined,
          duration: data.duration,
          ts: new Date(),
        },
      ]);
    } catch (err) {
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          output: "",
          error: String(err),
          ts: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      runCommand(input);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(cmdHistoryIdx + 1, cmdHistory.length - 1);
      setCmdHistoryIdx(newIdx);
      if (cmdHistory[newIdx]) setInput(cmdHistory[newIdx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = Math.max(cmdHistoryIdx - 1, -1);
      setCmdHistoryIdx(newIdx);
      setInput(newIdx === -1 ? "" : (cmdHistory[newIdx] || ""));
    }
  };

  const clearHistory = () => setHistory([]);

  const copyAll = () => {
    const text = history.map((h) => `$ ${h.command}\n${h.output}`).join("\n\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "1.25rem 1.5rem 0.75rem", flexShrink: 0 }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.125rem" }}>
              Browser Terminal
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Read-only commands only (ls, cat, df, ps, git status, etc.)
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={copyAll} style={{ padding: "0.375rem 0.75rem", borderRadius: "0.5rem", background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem" }}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button onClick={clearHistory} style={{ padding: "0.375rem 0.75rem", borderRadius: "0.5rem", background: "var(--card)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem" }}>
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Quick commands */}
      <div style={{ padding: "0.5rem 1.5rem", flexShrink: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              onClick={() => runCommand(cmd)}
              disabled={loading}
              style={{
                padding: "0.25rem 0.625rem", borderRadius: "0.375rem",
                fontSize: "0.72rem", fontFamily: "monospace",
                backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)",
                border: "1px solid var(--border)", cursor: "pointer",
                opacity: loading ? 0.5 : 1,
              }}
            >
              {cmd.length > 30 ? cmd.slice(0, 28) + "…" : cmd}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={outputRef}
        style={{
          flex: 1, overflow: "auto",
          margin: "0.75rem 1.5rem",
          backgroundColor: "#0d1117",
          borderRadius: "0.75rem",
          padding: "1rem",
          border: "1px solid #30363d",
          fontFamily: "monospace",
          fontSize: "0.8rem",
          lineHeight: 1.6,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {history.length === 0 ? (
          <div style={{ color: "#8b949e", textAlign: "center", paddingTop: "2rem" }}>
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Type a command or click a quick command above</p>
            <p style={{ fontSize: "0.7rem", marginTop: "0.5rem" }}>
              Arrow Up/Down for command history
            </p>
          </div>
        ) : (
          history.map((entry, i) => (
            <div key={i} style={{ marginBottom: "1rem" }}>
              {/* Command prompt */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <span style={{ color: "#4ade80" }}>superbotijo@srv</span>
                <span style={{ color: "#8b949e" }}>:</span>
                <span style={{ color: "#60a5fa" }}>~</span>
                <span style={{ color: "#c9d1d9" }}>$ {entry.command}</span>
                {entry.duration != null && (
                  <span style={{ color: "#484f58", fontSize: "0.7rem" }}>({entry.duration}ms)</span>
                )}
              </div>

              {/* Output */}
              {entry.error && (
                <pre style={{ color: "#f87171", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {entry.error}
                </pre>
              )}
              {entry.output && (
                <pre style={{ color: "#c9d1d9", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                  {entry.output}
                </pre>
              )}
            </div>
          ))
        )}

        {/* Loading indicator */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#8b949e" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#4ade80", animation: "pulse 1s infinite" }} />
            Running...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.75rem",
        margin: "0 1.5rem 1.5rem",
        padding: "0.625rem 1rem",
        backgroundColor: "#0d1117",
        borderRadius: "0.75rem",
        border: "1px solid #30363d",
        flexShrink: 0,
      }}>
        <span style={{ color: "#4ade80", fontFamily: "monospace", fontSize: "0.875rem", flexShrink: 0 }}>$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Enter command..."
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#c9d1d9",
            fontFamily: "monospace",
            fontSize: "0.875rem",
          }}
        />
        <button
          onClick={() => runCommand(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: "0.375rem 0.75rem",
            borderRadius: "0.5rem",
            backgroundColor: input.trim() && !loading ? "rgba(74,222,128,0.15)" : "transparent",
            color: input.trim() && !loading ? "#4ade80" : "#484f58",
            border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.8rem",
          }}
        >
          <Send className="w-3.5 h-3.5" />
          Run
        </button>
      </div>
    </div>
  );
}
