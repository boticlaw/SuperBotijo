"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, Download, Star, Loader2, Package, X } from "lucide-react";

interface ClawHubSkill {
  slug: string;
  displayName: string;
  summary: string;
  stats: {
    downloads: number;
    stars: number;
    comments: number;
    versions: number;
  };
  owner: {
    handle: string;
    displayName: string;
    image: string;
  };
  latestVersion: {
    version: string;
    createdAt: number;
    changelog: string;
  };
  score?: number;
}

interface ClawHubBrowserProps {
  onInstall?: (slug: string) => void;
  onClose?: () => void;
}

export function ClawHubBrowser({ onInstall, onClose }: ClawHubBrowserProps) {
  const [query, setQuery] = useState("");
  const [skills, setSkills] = useState<ClawHubSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/skills/clawhub/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSkills(data.skills || []);
      }
    } catch (err) {
      setError("Failed to search ClawHub");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (slug: string) => {
    setInstalling(slug);
    setError(null);

    try {
      const res = await fetch("/api/skills/clawhub/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      const data = await res.json();

      if (data.error) {
        setError(`Failed to install ${slug}: ${data.error}`);
      } else {
        // Success - notify parent
        if (onInstall) {
          onInstall(slug);
        }
        // Remove from list
        setSkills(skills.filter(s => s.slug !== slug));
      }
    } catch (err) {
      setError(`Failed to install ${slug}`);
      console.error(err);
    } finally {
      setInstalling(null);
    }
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "var(--card)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5" style={{ color: "var(--accent)" }} />
          <h3
            className="font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Browse ClawHub
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-opacity-10"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search skills..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: "var(--card-elevated)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50"
            style={{
              backgroundColor: "var(--accent)",
              color: "white",
            }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-4 mb-4 p-3 rounded-lg text-sm"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "var(--error)",
          }}
        >
          {error}
        </div>
      )}

      {/* Results */}
      <div className="max-h-[500px] overflow-y-auto">
        {skills.length === 0 && query && !loading && (
          <div className="p-8 text-center">
            <Package
              className="w-12 h-12 mx-auto mb-3"
              style={{ color: "var(--text-muted)" }}
            />
            <p style={{ color: "var(--text-secondary)" }}>
              No skills found for &quot;{query}&quot;
            </p>
          </div>
        )}

        {skills.map((skill) => (
          <div
            key={skill.slug}
            className="p-4 transition-all hover:bg-opacity-50"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-start justify-between gap-4">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4
                    className="font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {skill.displayName}
                  </h4>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: "var(--card-elevated)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    v{skill.latestVersion.version}
                  </span>
                </div>

                <p
                  className="text-sm mb-2 line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {skill.summary}
                </p>

                <div className="flex items-center gap-4 text-xs">
                  {/* Owner */}
                  <div className="flex items-center gap-1">
                    <Image
                      src={skill.owner.image}
                      alt={skill.owner.displayName}
                      width={16}
                      height={16}
                      unoptimized
                      className="w-4 h-4 rounded-full"
                    />
                    <span style={{ color: "var(--text-muted)" }}>
                      {skill.owner.handle}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Download className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                      <span style={{ color: "var(--text-muted)" }}>
                        {formatNumber(skill.stats.downloads)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" style={{ color: "var(--warning)" }} />
                      <span style={{ color: "var(--text-muted)" }}>
                        {formatNumber(skill.stats.stars)}
                      </span>
                    </div>
                  </div>

                  {skill.score && (
                    <span
                      className="px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: "var(--accent)",
                        color: "white",
                      }}
                    >
                      {skill.score.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Install button */}
              <button
                onClick={() => handleInstall(skill.slug)}
                disabled={installing === skill.slug}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: "var(--success)",
                  color: "white",
                }}
              >
                {installing === skill.slug ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3" />
                    Install
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
