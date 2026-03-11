#!/usr/bin/env npx tsx
/**
 * Documentation i18n Translator
 *
 * Automatically translates documentation sections using LLM.
 * Only translates sections that are missing or changed in translations.
 *
 * Usage:
 *   npm run docs:translate              # Translate all configured docs
 *   npm run docs:translate -- README.md # Translate specific file
 *
 * Environment:
 *   TRANSLATE_API_KEY  - API key for the translation model
 *   TRANSLATE_MODEL    - Model to use (default: glm-4.7-flash)
 *   TRANSLATE_BASE_URL - API base URL (default: Zhipu AI)
 */

import fs from "fs";
import path from "path";
import https from "https";
import { execSync } from "child_process";

// Types
interface TranslationConfig {
  required: boolean;
  translations: Record<string, string>;
}

interface Config {
  version: string;
  baseLanguage: string;
  languages: string[];
  documents: Record<string, TranslationConfig>;
  checkLevel: "warn" | "error";
}

interface Section {
  level: number;
  text: string;
  content: string;
  lineStart: number;
  lineEnd: number;
}

// Configuration
const DEFAULT_MODEL = "glm-4.7-flash";
const DEFAULT_BASE_URL = "https://api.z.ai/api/coding/paas/v4";

// Try to get API key from environment or OpenClaw config
function getApiKey(): { key: string; model: string; baseUrl: string } {
  // First, check environment variable
  if (process.env.TRANSLATE_API_KEY) {
    return {
      key: process.env.TRANSLATE_API_KEY,
      model: process.env.TRANSLATE_MODEL || DEFAULT_MODEL,
      baseUrl: process.env.TRANSLATE_BASE_URL || DEFAULT_BASE_URL,
    };
  }

  // Try to read from OpenClaw config
  try {
    const openclawPath = path.join(process.env.HOME || "", ".openclaw", "openclaw.json");
    if (fs.existsSync(openclawPath)) {
      const config = JSON.parse(fs.readFileSync(openclawPath, "utf-8"));

      // Check for GEMINI_API_KEY in env.vars
      if (config.env?.vars?.GEMINI_API_KEY) {
        return {
          key: config.env.vars.GEMINI_API_KEY,
          model: "gemini-2.5-flash",
          baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        };
      }
    }
  } catch {
    // Ignore errors reading OpenClaw config
  }

  return { key: "", model: DEFAULT_MODEL, baseUrl: DEFAULT_BASE_URL };
}

const { API_KEY, MODEL, BASE_URL } = (() => {
  const { key, model, baseUrl } = getApiKey();
  return {
    API_KEY: key,
    MODEL: model,
    BASE_URL: baseUrl,
  };
})();

// Load configuration
function loadConfig(): Config {
  const configPath = path.join(process.cwd(), "docs-i18n.config.json");

  if (!fs.existsSync(configPath)) {
    console.error("❌ docs-i18n.config.json not found");
    console.error("   Run: npm run docs:init to create one");
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// Get staged markdown files from git
function getStagedFiles(): string[] {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACMR", {
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean).filter(f => f.endsWith(".md"));
  } catch {
    return [];
  }
}

// Extract sections from markdown (ignoring code blocks)
function extractSections(filePath: string): Section[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const sections: Section[] = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code block boundaries
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      sections.push({
        level: match[1].length,
        text: match[2].trim(),
        content: line,
        lineStart: i + 1,
        lineEnd: i + 1,
      });
    }
  }

  // Extract content for each section (from header to next header or end)
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const nextSection = sections[i + 1];
    const endLine = nextSection ? nextSection.lineStart - 1 : lines.length;

    section.content = lines.slice(section.lineStart - 1, endLine).join("\n");
    section.lineEnd = endLine;
  }

  return sections;
}

// Check if we're using Gemini API
function isGeminiAPI(): boolean {
  return BASE_URL.includes("generativelanguage.googleapis.com");
}

// Call Gemini API
async function callGemini(prompt: string): Promise<string> {
  const systemPrompt =
    "You are a professional translator. Translate the following markdown content to Spanish. " +
    "Keep the exact same markdown structure, formatting, and code blocks. " +
    "Only translate the text content. Do not translate code, URLs, file paths, or command examples. " +
    "Respond ONLY with the translated markdown, no explanations.";

  const requestData = JSON.stringify({
    contents: [
      {
        parts: [
          { text: systemPrompt + "\n\n" + prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: `/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(requestData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`Gemini API Error: ${response.error.message || JSON.stringify(response.error)}`));
          } else if (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text) {
            resolve(response.candidates[0].content.parts[0].text);
          } else {
            reject(new Error(`Unexpected Gemini response: ${data.slice(0, 300)}`));
          }
        } catch {
          reject(new Error(`Failed to parse Gemini response: ${data.slice(0, 300)}`));
        }
      });
    });

    req.on("error", (e) => {
      reject(new Error(`Gemini request failed: ${e.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

// Call OpenAI-compatible API (Zhipu, etc.)
async function callOpenAICompatible(prompt: string): Promise<string> {
  const requestData = JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a professional translator. Translate the following markdown content to Spanish. " +
          "Keep the exact same markdown structure, formatting, and code blocks. " +
          "Only translate the text content. Do not translate code, URLs, file paths, or command examples. " +
          "Respond ONLY with the translated markdown, no explanations.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: "/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "Content-Length": Buffer.byteLength(requestData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`API Error: ${response.error.message || JSON.stringify(response.error)}`));
          } else if (response.choices && response.choices[0]) {
            resolve(response.choices[0].message.content);
          } else {
            reject(new Error(`Unexpected response: ${data.slice(0, 200)}`));
          }
        } catch {
          reject(new Error(`Failed to parse response: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on("error", (e) => {
      reject(new Error(`Request failed: ${e.message}`));
    });

    req.write(requestData);
    req.end();
  });
}

// Call LLM API (auto-detects Gemini vs OpenAI-compatible)
async function callLLM(prompt: string): Promise<string> {
  if (!API_KEY) {
    console.error("❌ No API key found");
    console.error("   Set TRANSLATE_API_KEY environment variable");
    console.error("   Or configure GEMINI_API_KEY in OpenClaw");
    process.exit(1);
  }

  if (isGeminiAPI()) {
    return callGemini(prompt);
  } else {
    return callOpenAICompatible(prompt);
  }
}

// Translate a section
async function translateSection(section: Section): Promise<string> {
  console.log(`  🔄 Translating: "${section.text.slice(0, 40)}..."`);

  try {
    const translated = await callLLM(section.content);
    return translated;
  } catch (error) {
    console.error(`  ❌ Failed to translate section: ${error}`);
    return section.content; // Return original on error
  }
}

// Find missing/changed sections
function findSectionsToTranslate(
  baseSections: Section[],
  translationSections: Section[]
): { missing: Section[]; changed: { base: Section; translation: Section }[] } {
  const missing: Section[] = [];
  const changed: { base: Section; translation: Section }[] = [];

  // Find sections in base that don't exist in translation
  for (let i = 0; i < baseSections.length; i++) {
    const baseSection = baseSections[i];
    const translationSection = translationSections[i];

    if (!translationSection) {
      // Section doesn't exist in translation
      missing.push(baseSection);
    } else if (baseSection.level !== translationSection.level) {
      // Header level mismatch - mark as changed
      changed.push({ base: baseSection, translation: translationSection });
    }
  }

  return { missing, changed };
}

// Translate a document
async function translateDocument(
  baseFile: string,
  translationFile: string,
  language: string
): Promise<boolean> {
  const basePath = path.join(process.cwd(), baseFile);
  const translationPath = path.join(process.cwd(), translationFile);

  console.log(`\n📄 Processing: ${baseFile} → ${translationFile} (${language})`);

  if (!fs.existsSync(basePath)) {
    console.log(`  ⚠️  Base file not found: ${baseFile}`);
    return false;
  }

  const baseSections = extractSections(basePath);
  const translationExists = fs.existsSync(translationPath);
  const translationSections = translationExists ? extractSections(translationPath) : [];

  console.log(`  📊 Base: ${baseSections.length} sections, Translation: ${translationSections.length} sections`);

  // Check what needs translation
  const { missing, changed } = findSectionsToTranslate(baseSections, translationSections);

  if (missing.length === 0 && changed.length === 0 && translationSections.length === baseSections.length) {
    console.log(`  ✅ Already in sync, no translation needed`);
    return true;
  }

  // If translation is significantly behind, translate the whole document
  if (!translationExists || translationSections.length < baseSections.length * 0.5) {
    console.log(`  🔄 Translation is significantly behind, translating entire document...`);

    const fullContent = fs.readFileSync(basePath, "utf-8");
    const translated = await callLLM(fullContent);

    // Ensure directory exists
    const dir = path.dirname(translationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(translationPath, translated);
    console.log(`  ✅ Translated entire document to ${translationFile}`);
    return true;
  }

  // Translate missing sections
  if (missing.length > 0) {
    console.log(`  🔄 Translating ${missing.length} missing sections...`);

    // Read existing translation content
    const translationContent = fs.readFileSync(translationPath, "utf-8");
    const lines = translationContent.split("\n");

    // Insert translated sections at the right positions
    for (const section of missing) {
      const translatedSection = await translateSection(section);

      // Find insertion point (before next header in translation)
      const insertLine = translationSections.length > 0
        ? translationSections[translationSections.length - 1].lineEnd
        : lines.length;

      // Insert the translated section
      lines.splice(insertLine, 0, "", translatedSection);
    }

    fs.writeFileSync(translationPath, lines.join("\n"));
    console.log(`  ✅ Added ${missing.length} translated sections`);
  }

  return true;
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();

  // Parse --staged flag
  const stagedMode = args.includes("--staged");
  const specificFiles = args.filter(arg => !arg.startsWith("--"));

  console.log(`\n🌐 Documentation Translator`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   API: ${BASE_URL}`);

  if (!API_KEY) {
    console.error("\n❌ TRANSLATE_API_KEY not set");
    console.error("   Set it in your environment:");
    console.error("   export TRANSLATE_API_KEY=your-api-key");
    console.error("\n   For Zhipu AI (GLM models), get your key from: https://open.bigmodel.cn/");
    process.exit(1);
  }

  // Determine files to translate
  let filesToTranslate: string[] = [];

  if (stagedMode) {
    const stagedFiles = getStagedFiles();
    // Find which configured docs are staged
    filesToTranslate = Object.keys(config.documents).filter(doc =>
      stagedFiles.includes(doc)
    );
    if (filesToTranslate.length === 0) {
      console.log("\n📚 No staged documentation files to translate");
      process.exit(0);
    }
  } else if (specificFiles.length > 0) {
    filesToTranslate = specificFiles;
  } else {
    filesToTranslate = Object.keys(config.documents);
  }

  console.log(`\n📚 Translating ${filesToTranslate.length} document(s)...\n`);

  let success = true;

  for (const baseFile of filesToTranslate) {
    const docConfig = config.documents[baseFile];
    if (!docConfig) {
      console.log(`  ℹ️  ${baseFile} has no translations configured`);
      continue;
    }

    for (const [language, translationFile] of Object.entries(docConfig.translations)) {
      const result = await translateDocument(baseFile, translationFile, language);
      if (!result) success = false;
    }
  }

  console.log(success ? "\n✅ Translation complete!" : "\n⚠️  Translation completed with errors");
  process.exit(success ? 0 : 1);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
