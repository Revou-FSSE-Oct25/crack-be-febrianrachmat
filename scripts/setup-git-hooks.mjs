import { chmodSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

if (!existsSync(".git")) {
  process.exit(0);
}

const hook = join(".githooks", "commit-msg");
if (!existsSync(hook)) {
  console.warn("setup-git-hooks: missing .githooks/commit-msg");
  process.exit(0);
}

try {
  chmodSync(hook, 0o755);
} catch {
  /* Windows may ignore mode; hook still runs via sh */
}

execSync("git config core.hooksPath .githooks", { stdio: "inherit" });
