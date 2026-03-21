"use client";

import { useRef, useEffect, useState } from "react";
import cloud from "d3-cloud";
import { Search } from "lucide-react";
import type { WordFrequency } from "@/app/api/memories/word-cloud/route";

interface MemoryWordCloudProps {
  words: WordFrequency[];
  onWordClick?: (word: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  person: "#3b82f6",
  project: "#8b5cf6",
  technology: "#10b981",
  concept: "#f59e0b",
  general: "#6b7280",
};

interface CloudWord {
  text: string;
  size: number;
  count: number;
  category: WordFrequency["category"];
  x?: number;
  y?: number;
  rotate?: number;
}

export function MemoryWordCloud({ words, onWordClick }: MemoryWordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [cloudWords, setCloudWords] = useState<CloudWord[]>([]);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: Math.max(width, 300), height: Math.max(height, 300) });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    if (words.length === 0) {
      // Intentional state reset when words are cleared
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCloudWords([]);
      return;
    }

    const maxCount = Math.max(...words.map((w) => w.count));
    const minCount = Math.min(...words.map((w) => w.count));
    const range = maxCount - minCount || 1;

    const wordEntries: CloudWord[] = words.map((w) => ({
      text: w.word,
      size: 12 + ((w.count - minCount) / range) * 36,
      count: w.count,
      category: w.category,
    }));

    const layout = cloud<CloudWord>()
      .size([dimensions.width, dimensions.height])
      .words(wordEntries)
      .padding(4)
      .rotate(() => (Math.random() > 0.7 ? 90 : 0))
      .font("sans-serif")
      .fontSize((d) => d.size)
      .on("end", (computedWords) => {
        setCloudWords(
          computedWords.map((w) => ({
            text: w.text || "",
            size: w.size || 16,
            count: (w as CloudWord).count,
            category: (w as CloudWord).category,
            x: w.x,
            y: w.y,
            rotate: w.rotate,
          }))
        );
      });

    layout.start();
  }, [words, dimensions]);

  if (words.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "300px",
          color: "var(--text-muted)",
        }}
      >
        No words found in memories
      </div>
    );
  }

  const hoveredData = hoveredWord ? words.find((w) => w.word === hoveredWord) : null;

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%", height: "100%", minHeight: "300px" }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        style={{ width: "100%", height: "100%" }}
      >
        <g transform={`translate(${dimensions.width / 2},${dimensions.height / 2})`}>
          {cloudWords.map((word, i) => (
            <text
              key={`${word.text}-${i}`}
              textAnchor="middle"
              transform={`translate(${word.x || 0},${word.y || 0})rotate(${word.rotate || 0})`}
              style={{
                fontSize: `${word.size}px`,
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fill: hoveredWord === word.text ? "#fff" : CATEGORY_COLORS[word.category],
                cursor: "pointer",
                transition: "fill 150ms ease",
                filter: hoveredWord === word.text ? `drop-shadow(0 0 8px ${CATEGORY_COLORS[word.category]})` : "none",
              }}
              onMouseEnter={() => setHoveredWord(word.text)}
              onMouseLeave={() => setHoveredWord(null)}
              onClick={() => onWordClick?.(word.text)}
            >
              {word.text}
            </text>
          ))}
        </g>
      </svg>

      {hoveredWord && hoveredData && (
        <div
          style={{
            position: "absolute",
            top: "16px",
            left: "16px",
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "12px",
            color: "var(--text-primary)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Search size={14} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 600 }}>{hoveredWord}</span>
          <span style={{ color: "var(--text-muted)" }}>{hoveredData.count} occurrences</span>
          <span
            style={{
              padding: "2px 6px",
              backgroundColor: CATEGORY_COLORS[hoveredData.category],
              borderRadius: "4px",
              fontSize: "10px",
              color: "#fff",
              textTransform: "capitalize",
            }}
          >
            {hoveredData.category}
          </span>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: "16px",
          right: "16px",
          display: "flex",
          gap: "12px",
          fontSize: "10px",
        }}
      >
        {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
          <div key={category} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: color }} />
            <span style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>{category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
