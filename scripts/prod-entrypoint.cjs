#!/usr/bin/env node
/**
 * Production start: migrate + optional seed, then boot Nest.
 * Works on hosts that ignore Dockerfile entrypoint (e.g. OpsCtrl buildpacks).
 */
const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

function run(cmd) {
  console.log(`[prod-entrypoint] ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

const mainJs = path.join(__dirname, "..", "dist", "main.js");
if (!existsSync(mainJs)) {
  console.error(`[prod-entrypoint] missing ${mainJs} — run npm run build first`);
  process.exit(1);
}

try {
  run("npx prisma migrate deploy");
} catch (err) {
  console.error("[prod-entrypoint] migrate deploy failed", err);
  process.exit(1);
}

if (process.env.RUN_DB_SEED === "true") {
  try {
    run("npx prisma db seed");
  } catch (err) {
    console.error("[prod-entrypoint] seed failed", err);
    process.exit(1);
  }
}

require(mainJs);
