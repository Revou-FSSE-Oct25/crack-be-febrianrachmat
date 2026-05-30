/**
 * `tsc` only emits .js/.d.ts and ignores non-TS assets, so the i18n JSON
 * translation files are not copied to `dist` automatically. This step mirrors
 * `src/i18n` into `dist/i18n` after the TypeScript build so the runtime loader
 * (which reads from `__dirname/i18n`) finds them in production.
 */
import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(projectRoot, "src/i18n");
const destination = resolve(projectRoot, "dist/i18n");

if (!existsSync(source)) {
  console.warn(`[copy-i18n] No i18n directory found at ${source}, skipping.`);
  process.exit(0);
}

await cp(source, destination, { recursive: true });
console.log(`[copy-i18n] Copied translations to ${destination}`);
