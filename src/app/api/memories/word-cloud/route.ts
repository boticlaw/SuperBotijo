import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || "/home/daniel/.openclaw";
const WORKSPACE = path.join(OPENCLAW_DIR, "workspace");

export interface WordFrequency {
  word: string;
  count: number;
  category: "person" | "project" | "technology" | "concept" | "general";
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
  "shall", "can", "need", "dare", "ought", "used", "it", "its", "this", "that",
  "these", "those", "i", "you", "he", "she", "we", "they", "me", "him", "her", "us",
  "them", "my", "your", "his", "our", "their", "mine", "yours", "hers", "ours",
  "el", "la", "los", "las", "un", "una", "unos", "unas", "y", "o", "pero", "si",
  "no", "en", "de", "del", "al", "por", "para", "con", "sin", "sobre", "entre",
  "hacia", "hasta", "desde", "que", "quien", "cual", "donde", "cuando", "como",
  "muy", "más", "menos", "mucho", "poco", "todo", "nada", "algo", "también",
  "siempre", "nunca", "ya", "todavía", "aún", "ser", "es", "son", "está", "están",
  "era", "fueron", "ha", "han", "he", "hemos", "han", "tener", "tiene", "tienen",
  "lo", "le", "se", "me", "te", "nos", "les", "su", "sus", "mi", "mis", "tu",
  "tus", "nuestro", "nuestra", "nuestros", "nuestras", "su", "sus", "1", "2", "3",
  "4", "5", "6", "7", "8", "9", "0", "https", "http", "www", "com", "org", "net",
]);

const TECHNOLOGY_WORDS = new Set([
  "react", "next", "typescript", "javascript", "python", "node", "docker", "kubernetes",
  "aws", "gcp", "azure", "postgresql", "mongodb", "redis", "sqlite", "tailwind",
  "bootstrap", "git", "github", "gitlab", "api", "rest", "graphql", "json", "yaml",
  "css", "html", "npm", "yarn", "webpack", "vite", "jest", "cypress", "linux",
  "ubuntu", "debian", "nginx", "apache", "firebase", "supabase", "vercel",
]);

const PROJECT_WORDS = new Set([
  "superbotijo", "openclaw", "dashboard", "bot", "agent", "workflow", "cron",
  "memory", "session", "project", "app", "application", "system", "service",
]);

const PERSON_WORDS = new Set([
  "dani", "edu", "marc", "johnny", "twitter", "linkedin", "telegram", "gmail",
]);

function categorizeWord(word: string): WordFrequency["category"] {
  const lower = word.toLowerCase();
  if (TECHNOLOGY_WORDS.has(lower)) return "technology";
  if (PROJECT_WORDS.has(lower)) return "project";
  if (PERSON_WORDS.has(lower)) return "person";
  if (word.length > 8 && /[A-Z]/.test(word[0])) return "concept";
  return "general";
}

function processText(text: string): Map<string, number> {
  const words = new Map<string, number>();

  const cleaned = text
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  for (const word of cleaned) {
    words.set(word, (words.get(word) || 0) + 1);
  }

  return words;
}

function readMemoryFiles(source: string): string {
  let content = "";

  if (source === "memory" || source === "all") {
    const memoryPath = path.join(WORKSPACE, "MEMORY.md");
    try {
      if (fs.existsSync(memoryPath)) {
        content += fs.readFileSync(memoryPath, "utf-8") + " ";
      }
    } catch {}
  }

  if (source === "daily" || source === "all") {
    const memoryDir = path.join(WORKSPACE, "memory");
    try {
      if (fs.existsSync(memoryDir)) {
        const files = fs.readdirSync(memoryDir);
        const recent = files.filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 30);
        for (const file of recent) {
          content += fs.readFileSync(path.join(memoryDir, file), "utf-8") + " ";
        }
      }
    } catch {}
  }

  return content;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "all";
  const limit = parseInt(searchParams.get("limit") || "80", 10);

  try {
    const text = readMemoryFiles(source);

    if (!text.trim()) {
      return NextResponse.json({ words: [] });
    }

    const wordCounts = processText(text);

    const sorted = Array.from(wordCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const words: WordFrequency[] = sorted.map(([word, count]) => ({
      word,
      count,
      category: categorizeWord(word),
    }));

    return NextResponse.json({ words });
  } catch (error) {
    console.error("[word-cloud] Error:", error);
    return NextResponse.json({ error: "Failed to process memories" }, { status: 500 });
  }
}
