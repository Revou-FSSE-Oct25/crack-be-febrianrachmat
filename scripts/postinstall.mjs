/**
 * Local `npm install` only. Docker/CI use `npm ci --ignore-scripts` then
 * explicit `prisma generate` to avoid OOM during install on small builders.
 */
import { execSync } from "node:child_process";

if (
  process.env.CI === "true" ||
  process.env.RAILWAY === "true" ||
  process.env.SKIP_PRISMA_POSTINSTALL === "1"
) {
  process.exit(0);
}

execSync("prisma generate", { stdio: "inherit" });
