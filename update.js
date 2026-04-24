#!/usr/bin/env node

/**
 * Update script for superpowers-orchestrator
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const INSTALL_DIR = path.join(os.homedir(), ".superpowers-orchestrator");
const ROLES_SOURCE = path.join(process.cwd(), "roles");
const SKILLS_SOURCE = path.join(process.cwd(), "skills");
const AGENTS_SKILLS_DIR = path.join(os.homedir(), ".agents", "skills");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function printColor(text, color = "36") {
  console.log(`\x1b[${color}m%s\x1b[0m`, text);
}

async function main() {
  printColor("=== Superpowers Orchestrator Updater ===\n", "1;36");

  if (!fs.existsSync(INSTALL_DIR)) {
    console.error("Not installed. Run: npx superpowers-orchestrator install");
    process.exit(1);
  }

  // 1. Git pull if it's a git repo
  const gitDir = path.join(INSTALL_DIR, ".git");
  if (fs.existsSync(gitDir)) {
    console.log("Pulling latest changes...");
    try {
      execSync("git pull", { cwd: INSTALL_DIR, stdio: "inherit" });
    } catch (e) {
      console.error("Git pull failed:", e.message);
      process.exit(1);
    }
  } else {
    console.log("Not a git repo. Copying from current directory...");
    const cwd = process.cwd();
    copyDir(cwd, INSTALL_DIR);
  }

  // 2. Rebuild
  console.log("\nRebuilding...");
  try {
    execSync("npm install", { cwd: INSTALL_DIR, stdio: "inherit" });
    execSync("npm run build", { cwd: INSTALL_DIR, stdio: "inherit" });
  } catch (e) {
    console.error("Build failed:", e.message);
    process.exit(1);
  }

  // 3. Update roles from source if available
  const installRolesDir = path.join(INSTALL_DIR, "roles");
  if (fs.existsSync(ROLES_SOURCE)) {
    copyDir(ROLES_SOURCE, installRolesDir);
    console.log("✓ Roles updated from:", ROLES_SOURCE);
  }

  // 4. Update skills
  ensureDir(AGENTS_SKILLS_DIR);
  if (fs.existsSync(SKILLS_SOURCE)) {
    const entries = fs.readdirSync(SKILLS_SOURCE, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const src = path.join(SKILLS_SOURCE, entry.name);
        const dest = path.join(AGENTS_SKILLS_DIR, entry.name);
        copyDir(src, dest);
        console.log("✓ Skill updated:", entry.name);
      }
    }
  }

  printColor("\n=== Update Complete ===", "1;32");
  printColor("Restart your IDE to reload the MCP server.", "33");
}

main().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
