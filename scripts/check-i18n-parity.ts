import fs from "fs";
import path from "path";

interface I18nObject {
  [key: string]: string | I18nObject;
}

function flattenKeys(obj: I18nObject, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key in obj) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys.push(...flattenKeys(obj[key] as I18nObject, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

function detectTypeCollisions(obj: I18nObject, prefix = ""): string[] {
  const collisions: string[] = [];
  const leafPaths = new Set<string>();
  const objectPaths = new Set<string>();

  function traverse(o: I18nObject, p = "") {
    for (const key in o) {
      const fullPath = p ? `${p}.${key}` : key;
      if (typeof o[key] === "object" && o[key] !== null) {
        objectPaths.add(fullPath);
        traverse(o[key] as I18nObject, fullPath);
      } else {
        leafPaths.add(fullPath);
      }
    }
  }

  traverse(obj, prefix);

  for (const leaf of leafPaths) {
    if (objectPaths.has(leaf)) {
      collisions.push(leaf);
    }
  }

  return collisions;
}

function main(): void {
  const enPath = path.join(process.cwd(), "src/i18n/messages/en.json");
  const esPath = path.join(process.cwd(), "src/i18n/messages/es.json");

  const en: I18nObject = JSON.parse(fs.readFileSync(enPath, "utf-8"));
  const es: I18nObject = JSON.parse(fs.readFileSync(esPath, "utf-8"));

  let hasErrors = false;

  const enCollisions = detectTypeCollisions(en);
  const esCollisions = detectTypeCollisions(es);

  if (enCollisions.length > 0) {
    console.error("\x1b[31m%s\x1b[0m", `Type collisions in en.json (${enCollisions.length}):`);
    enCollisions.forEach((c) => console.error(`  - ${c} (used as both string and object parent)`));
    hasErrors = true;
  }

  if (esCollisions.length > 0) {
    console.error("\x1b[31m%s\x1b[0m", `Type collisions in es.json (${esCollisions.length}):`);
    esCollisions.forEach((c) => console.error(`  - ${c} (used as both string and object parent)`));
    hasErrors = true;
  }

  const enKeys = new Set(flattenKeys(en));
  const esKeys = new Set(flattenKeys(es));

  const onlyInEn = [...enKeys].filter((k) => !esKeys.has(k)).sort();
  const onlyInEs = [...esKeys].filter((k) => !enKeys.has(k)).sort();

  if (onlyInEn.length > 0) {
    console.error("\x1b[31m%s\x1b[0m", `Missing in es.json (${onlyInEn.length} keys):`);
    onlyInEn.forEach((k) => console.error(`  - ${k}`));
    hasErrors = true;
  }

  if (onlyInEs.length > 0) {
    console.error("\x1b[31m%s\x1b[0m", `\nMissing in en.json (${onlyInEs.length} keys):`);
    onlyInEs.forEach((k) => console.error(`  - ${k}`));
    hasErrors = true;
  }

  if (hasErrors) {
    console.error("\n\x1b[31m%s\x1b[0m", "i18n parity check FAILED");
    process.exit(1);
  }

  console.log("\x1b[32m%s\x1b[0m", `i18n parity check passed (${enKeys.size} keys in both files)`);
}

main();
