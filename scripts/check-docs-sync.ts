#!/usr/bin/env npx tsx
/**
 * Documentation i18n Sync Checker
 *
 * Validates that documentation files are synchronized across languages.
 * Compares document structure (section count and header levels), not text content.
 *
 * Why structure comparison?
 * - Translated text will always differ, that's expected
 * - What matters is: same number of sections, same header hierarchy
 * - Detects when someone adds a section in English then forgets Spanish
 *
 * Usage:
 *   npm run docs:check                    # Check all configured documents
 *   npm run docs:check -- --staged        # Check only staged files
 *   npm run docs:check -- --changed       # Check only changed files
 *   npm run docs:check -- README.md       # Check specific file
 */

import fs from "fs";
import path from "path";
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
  ignoredPaths: string[];
  checkLevel: "warn" | "error";
  checkOn: ("pre-commit" | "ci" | "manual")[];
}

interface Section {
  level: number;
  text: string;
  line: number;
}

interface LevelMismatch {
  position: number;
  baseHeader: string;
  translationHeader: string;
  baseLevel: number;
  translationLevel: number;
}

interface StructureDiff {
  baseFile: string;
  translationFile: string;
  language: string;
  baseSectionCount: number;
  translationSectionCount: number;
  countMismatch: boolean;
  levelMismatches: LevelMismatch[];
  translationExists: boolean;
  required: boolean;
}

interface CompareResult {
  countMismatch: boolean;
  levelMismatches: LevelMismatch[];
}

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

// Extract markdown sections (headers), ignoring code blocks
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

    // Track code block boundaries (``` at start of line)
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    // Skip headers inside code blocks
    if (inCodeBlock) {
      continue;
    }

    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      sections.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return sections;
}

// Compare document structure (not text content)
function compareStructure(
  baseSections: Section[],
  translationSections: Section[]
): CompareResult {
  const levelMismatches: LevelMismatch[] = [];

  // Check if section counts match
  const countMismatch = baseSections.length !== translationSections.length;

  // Check header level alignment at each position
  const maxLen = Math.max(baseSections.length, translationSections.length);

  for (let i = 0; i < maxLen; i++) {
    const baseSection = baseSections[i];
    const translationSection = translationSections[i];

    // Both have section at this position - check level match
    if (baseSection && translationSection) {
      if (baseSection.level !== translationSection.level) {
        levelMismatches.push({
          position: i + 1,
          baseHeader: baseSection.text.slice(0, 30),
          translationHeader: translationSection.text.slice(0, 30),
          baseLevel: baseSection.level,
          translationLevel: translationSection.level,
        });
      }
    }
  }

  return { countMismatch, levelMismatches };
}

// Get changed files from git
function getChangedFiles(mode: "staged" | "changed"): string[] {
  try {
    const command =
      mode === "staged"
        ? "git diff --cached --name-only --diff-filter=ACMR"
        : "git diff HEAD --name-only --diff-filter=ACMR";
    const output = execSync(command, { encoding: "utf-8" });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// Check a single document
function checkDocument(
  baseFile: string,
  docConfig: TranslationConfig
): StructureDiff[] {
  const results: StructureDiff[] = [];
  const basePath = path.join(process.cwd(), baseFile);

  if (!fs.existsSync(basePath)) {
    console.log(`  ℹ️  Base file not found: ${baseFile}`);
    return results;
  }

  const baseSections = extractSections(basePath);

  for (const [language, translationFile] of Object.entries(
    docConfig.translations
  )) {
    const translationPath = path.join(process.cwd(), translationFile);
    const translationExists = fs.existsSync(translationPath);
    const translationSections = translationExists
      ? extractSections(translationPath)
      : [];

    const { countMismatch, levelMismatches } = compareStructure(
      baseSections,
      translationSections
    );

    results.push({
      baseFile,
      translationFile,
      language,
      baseSectionCount: baseSections.length,
      translationSectionCount: translationSections.length,
      countMismatch,
      levelMismatches,
      translationExists,
      required: docConfig.required,
    });
  }

  return results;
}

// Format output
function formatResults(results: StructureDiff[], checkLevel: string): boolean {
  let hasErrors = false;
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const result of results) {
    // Skip if translation doesn't exist and not required
    if (!result.translationExists && !result.required) {
      continue;
    }

    // Translation missing but required
    if (!result.translationExists && result.required) {
      const msg = `📄 ${result.baseFile} → Missing translation: ${result.translationFile} (${result.language})`;
      if (checkLevel === "error") {
        errors.push(msg);
        hasErrors = true;
      } else {
        warnings.push(msg);
      }
      continue;
    }

    // Translation exists but out of sync
    if (result.countMismatch || result.levelMismatches.length > 0) {
      const issues: string[] = [];

      if (result.countMismatch) {
        issues.push(
          `  ⚠️  Section count: ${result.baseSectionCount} → ${result.translationSectionCount} (expected ${result.baseSectionCount})`
        );
      }

      if (result.levelMismatches.length > 0) {
        issues.push(`  ⚠️  Header level mismatches:`);
        for (const m of result.levelMismatches) {
          issues.push(
            `    Position ${m.position}: Base H${m.baseLevel} "${m.baseHeader}" → Translation H${m.translationLevel} "${m.translationHeader}"`
          );
        }
      }

      if (issues.length > 0) {
        const msg = `📄 ${result.baseFile} ↔ ${result.translationFile} (${result.language})\n${issues.join("\n")}`;

        if (result.required && checkLevel === "error") {
          errors.push(msg);
          hasErrors = true;
        } else {
          warnings.push(msg);
        }
      }
    }
  }

  // Print output
  if (warnings.length > 0) {
    console.log("\n⚠️  Documentation sync warnings:\n");
    for (const w of warnings) {
      console.log(w + "\n");
    }
  }

  if (errors.length > 0) {
    console.log("\n❌ Documentation sync errors:\n");
    for (const e of errors) {
      console.log(e + "\n");
    }
  }

  if (warnings.length === 0 && errors.length === 0) {
    console.log("\n✅ All documentation is in sync!");
  }

  return hasErrors;
}

// Main
function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();

  // Debug mode
  if (process.env.DEBUG === "true") {
    console.log("[DEBUG] Running in development mode");
  }

  // Parse CLI arguments
  let mode: "staged" | "changed" | "all" = "all";
  const specificFiles: string[] = [];

  for (const arg of args) {
    if (arg === "--staged") {
      mode = "staged";
    } else if (arg === "--changed") {
      mode = "changed";
    } else if (!arg.startsWith("--")) {
      specificFiles.push(arg);
    }
  }

  // Determine files to check
  let filesToCheck: string[] = [];

  if (mode === "staged") {
    filesToCheck = getChangedFiles("staged").filter((f) => f.endsWith(".md"));
  } else if (mode === "changed") {
    filesToCheck = getChangedFiles("changed").filter((f) => f.endsWith(".md"));
  } else if (specificFiles.length > 0) {
    filesToCheck = specificFiles;
  } else {
    // Check all configured documents
    filesToCheck = Object.keys(config.documents);
  }

  if (filesToCheck.length === 0) {
    console.log("\n📚 No files to check");
    return;
  }

  console.log(`\n📚 Checking ${filesToCheck.length} document(s)...\n`);

  const allResults: StructureDiff[] = [];

  for (const baseFile of filesToCheck) {
    const docConfig = config.documents[baseFile];
    if (!docConfig) {
      console.log(`  ℹ️  ${baseFile} has no translations configured`);
      continue;
    }

    const results = checkDocument(baseFile, docConfig);
    allResults.push(...results);
  }

  const hasErrors = formatResults(allResults, config.checkLevel);

  // Pre-commit hook integration
  if (config.checkOn.includes("pre-commit")) {
    console.log("\n📚 Checking documentation sync... (pre-commit)");
    if (hasErrors) {
      console.log("\n💡 Tip: Update translations and try again.\n");
      process.exit(1);
    }
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
