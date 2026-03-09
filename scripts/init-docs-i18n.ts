#!/usr/bin/env npx tsx
/**
 * Initialize docs-i18n configuration
 *
 * Creates a docs-i18n.config.json file with default settings.
 *
 * Usage:
 *   npm run docs:init
 */

import fs from "fs";
import path from "path";

const DEFAULT_CONFIG = {
  "$schema": "./docs-i18n.schema.json",
  version: "1.0.0",
  baseLanguage: "en",
  languages: ["en", "es"],
  documents: {
    "README.md": {
      required: true,
      translations: {
        es: "README.es.md"
      }
    }
  },
  ignoredPaths: [
    "docs/",
    "public/",
    "node_modules/",
    ".next/"
  ],
  checkLevel: "warn"
};

const CONFIG_PATH = "docs-i18n.config.json";
const SCHEMA_PATH = "docs-i18n.schema.json";

function main() {
  // Check if config already exists
  if (fs.existsSync(CONFIG_PATH)) {
    console.log("✅ docs-i18n.config.json already exists");
    return;
  }

  // Create config file
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  console.log("✅ Created docs-i18n.config.json");

  // Check for schema
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.log("⚠️  docs-i18n.schema.json not found - skipping schema validation");
    console.log("   To add schema validation, copy the schema file from the SuperBotijo repo");
  }

  console.log("\n📚 Configuration:");
  console.log("   Base language: en");
  console.log("   Supported languages: en, es");
  console.log("   Check level: warn (set to 'error' in config to fail on mismatches)");
  console.log("\n🔧 Commands:");
  console.log("   npm run docs:check          - Check all configured docs");
  console.log("   npm run docs:check:staged   - Check only staged files");
  console.log("   npm run docs:check:changed  - Check changed files");
}

main();
