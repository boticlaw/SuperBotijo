import fs from "fs";
import path from "path";

interface I18nObject {
  [key: string]: string | I18nObject;
}

function flattenKeys(obj: I18nObject, prefix = ""): string[] {
  const keys: string[] = [];
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys.push(...flattenKeys(obj[key] as I18nObject, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function main(): void {
  const enPath = path.join(process.cwd(), "src/i18n/messages/en.json");
  const esPath = path.join(process.cwd(), "src/i18n/messages/es.json");

  const en: I18nObject = JSON.parse(fs.readFileSync(enPath, "utf-8"));
  const es: I18nObject = JSON.parse(fs.readFileSync(esPath, "utf-8"));

  const enKeys = new Set(flattenKeys(en));
  const esKeys = new Set(flattenKeys(es));

  const onlyInEn = [...enKeys].filter((k) => !esKeys.has(k)).sort();
  const onlyInEs = [...esKeys].filter((k) => !enKeys.has(k)).sort();

  let hasErrors = false;

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
