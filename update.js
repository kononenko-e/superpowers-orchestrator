#!/usr/bin/env node

/**
 * Interactive update script for superpowers-orchestrator
 * Detects installed components, shows selection UI, warns about overwrites, then updates.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import prompts from "prompts";

const REPO_URL = "https://github.com/kononenko-e/superpowers-orchestrator.git";
const INSTALL_DIR = path.join(os.homedir(), ".superpowers-orchestrator");
// Source paths point into INSTALL_DIR — after git-pull/copy the latest files are there,
// so the update command works from any directory.
const ROLES_SOURCE = path.join(INSTALL_DIR, "roles");
const SKILLS_SOURCE = path.join(INSTALL_DIR, "skills");
const AGENTS_SKILLS_DIR = path.join(os.homedir(), ".agents", "skills");
const PRIVATE_SKILLS_DIR = path.join(INSTALL_DIR, "skills", "behavioral");
const PUBLIC_SKILLS = new Set(["super-orchestrator", "caveman"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest, excludeDirs = []) {
  ensureDir(dest);

  const stats = fs.lstatSync(src);
  if (stats.isSymbolicLink()) {
    const target = fs.readlinkSync(src);
    const resolvedTarget = path.isAbsolute(target)
      ? target
      : path.resolve(path.dirname(src), target);
    if (fs.existsSync(resolvedTarget)) {
      copyDir(resolvedTarget, dest, excludeDirs);
    }
    return;
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeDirs.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludeDirs);
    } else if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(srcPath);
      const resolvedTarget = path.isAbsolute(target)
        ? target
        : path.resolve(path.dirname(srcPath), target);
      if (fs.existsSync(resolvedTarget)) {
        fs.copyFileSync(resolvedTarget, destPath);
      }
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function printColor(text, color = "36") {
  console.log(`\x1b[${color}m%s\x1b[0m`, text);
}

// ---------------------------------------------------------------------------
// IDE config path helpers (same as install.js)
// ---------------------------------------------------------------------------

function getClaudeDesktopConfigPath() {
  const p = os.platform();
  if (p === "darwin") return path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  if (p === "win32") return path.join(os.homedir(), "AppData/Roaming/Claude/claude_desktop_config.json");
  return path.join(os.homedir(), ".config/Claude/claude_desktop_config.json");
}

function getCursorConfigPath() {
  const p = os.platform();
  if (p === "darwin") return path.join(os.homedir(), "Library/Application Support/Cursor/User/globalStorage/mcp.json");
  if (p === "win32") return path.join(os.homedir(), "AppData/Roaming/Cursor/User/globalStorage/mcp.json");
  return path.join(os.homedir(), ".config/Cursor/User/globalStorage/mcp.json");
}

function getContinueConfigPath() {
  return path.join(os.homedir(), ".continue/config.json");
}

function getZedConfigPath() {
  const p = os.platform();
  if (p === "darwin") return path.join(os.homedir(), ".config/zed/settings.json");
  if (p === "win32") return path.join(os.homedir(), "AppData/Roaming/Zed/settings.json");
  return path.join(os.homedir(), ".config/zed/settings.json");
}

function getMcpSettingsPath(ide) {
  if (ide === "claude-desktop") return getClaudeDesktopConfigPath();
  if (ide === "github-copilot") return path.join(os.homedir(), "Library/Application Support/Code/User/mcp.json");
  if (ide === "cursor") return getCursorConfigPath();
  if (ide === "continue") return getContinueConfigPath();
  if (ide === "zed") return getZedConfigPath();
  if (ide === "windsurf") return path.join(os.homedir(), ".codeium/windsurf/mcp_config.json");
  const base = path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage");
  if (ide === "cline") return path.join(base, "saoudrizwan.claude-dev/settings/cline_mcp_settings.json");
  if (ide === "roocode") return path.join(base, "rooveterinaryinc.roo-cline/settings/mcp_settings.json");
  return null;
}

// ---------------------------------------------------------------------------
// Agent / workflow destination paths per IDE
// ---------------------------------------------------------------------------

function getAgentDest(ide) {
  const cwd = process.cwd();
  const map = {
    "claude-desktop": path.join(os.homedir(), ".github", "agents"),
    "github-copilot": path.join(os.homedir(), ".github", "agents"),
    "claude-code": path.join(os.homedir(), ".claude", "agents"),
    "cline": path.join(os.homedir(), "Documents", "Cline", "Workflows"),
    "roocode": path.join(os.homedir(), ".roo-cline", "custom-modes"),
    "cursor": path.join(cwd, ".cursor", "rules"),
    "windsurf": path.join(os.homedir(), ".codeium", "windsurf", "global_workflows"),
    "opencode": path.join(cwd, ".opencode", "agent"),
    "qwen": path.join(os.homedir(), ".qwen", "agents"),
  };
  return map[ide] || null;
}

function getAgentSourceDir(ide) {
  const map = {
    "claude-desktop": "copilot",
    "github-copilot": "copilot",
    "claude-code": "claude-code",
    "cline": "cline",
    "roocode": "roocode",
    "cursor": "cursor",
    "windsurf": "windsurf",
    "opencode": "opencode",
    "qwen": "qwen",
  };
  const dir = map[ide];
  if (!dir) return null;
  return path.join(INSTALL_DIR, "agents", dir);
}

// ---------------------------------------------------------------------------
// Detection: find which IDEs have our plugin installed
// ---------------------------------------------------------------------------

function hasMcpConfig(ide) {
  const settingsPath = getMcpSettingsPath(ide);
  if (!settingsPath || !fs.existsSync(settingsPath)) return false;
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const config = JSON.parse(raw);
    // Check both mcpServers and servers (Copilot uses "servers")
    if (config.mcpServers?.["superagents-mcp"]) return true;
    if (config.servers?.["superagents-mcp"]) return true;
  } catch { /* ignore parse errors */ }
  return false;
}

function hasAgentInstalled(ide) {
  const dest = getAgentDest(ide);
  if (!dest || !fs.existsSync(dest)) return false;
  const srcDir = getAgentSourceDir(ide);
  if (!srcDir || !fs.existsSync(srcDir)) return false;
  // Check if any file from our agent source exists in the destination
  const files = fs.readdirSync(srcDir);
  return files.some((f) => fs.existsSync(path.join(dest, f)));
}

function detectInstalledIdes() {
  const ides = [
    "claude-desktop",
    "claude-code",
    "github-copilot",
    "cline",
    "roocode",
    "cursor",
    "windsurf",
    "opencode",
    "qwen",
    "continue",
    "zed",
  ];

  const detected = [];
  for (const ide of ides) {
    const hasMcp = hasMcpConfig(ide);
    const hasAgent = hasAgentInstalled(ide);
    if (hasMcp || hasAgent) {
      detected.push({ ide, hasMcp, hasAgent });
    }
  }
  return detected;
}

function hasPublicSkillsInstalled() {
  for (const name of PUBLIC_SKILLS) {
    if (fs.existsSync(path.join(AGENTS_SKILLS_DIR, name))) return true;
  }
  return false;
}

function hasBehavioralSkillsInstalled() {
  return fs.existsSync(PRIVATE_SKILLS_DIR);
}

function hasRolesInstalled() {
  const rolesDir = path.join(INSTALL_DIR, "roles");
  return fs.existsSync(rolesDir) && fs.readdirSync(rolesDir).length > 0;
}

function hasBinWrapper() {
  const binDir = getBinDir();
  const platform = os.platform();
  const wrapperName = platform === "win32" ? "superagents-mcp.cmd" : "superagents-mcp";
  return fs.existsSync(path.join(binDir, wrapperName));
}

function getBinDir() {
  const platform = os.platform();
  if (platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), "superpowers-orchestrator");
  }
  const localBin = path.join(os.homedir(), ".local", "bin");
  if (fs.existsSync(localBin)) return localBin;
  return "/usr/local/bin";
}

// ---------------------------------------------------------------------------
// MCP config update (ensures env vars point to current install)
// ---------------------------------------------------------------------------

function updateMcpConfig(ide) {
  const settingsPath = getMcpSettingsPath(ide);
  if (!settingsPath) return false;

  let config = {};
  if (fs.existsSync(settingsPath)) {
    try {
      config = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      config = {};
    }
  }

  const entry = {
    command: "superagents-mcp",
    args: [],
    env: {
      SUPERPOWERS_ROLES_PATH: path.join(INSTALL_DIR, "roles"),
      SUPERPOWERS_SKILLS_PATH: PRIVATE_SKILLS_DIR,
    },
  };

  if (ide === "github-copilot") {
    if (!config.servers) config.servers = {};
    config.servers["superagents-mcp"] = { type: "stdio", ...entry };
  } else {
    if (!config.mcpServers) config.mcpServers = {};
    config.mcpServers["superagents-mcp"] = entry;
  }

  ensureDir(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2));
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  printColor("=== Superpowers Orchestrator Updater ===\n", "1;36");

  // ── 0. Pre-flight: installation must exist ──────────────────────────────
  if (!fs.existsSync(INSTALL_DIR)) {
    console.error("Plugin is not installed. Run: npx superpowers-orchestrator install");
    process.exit(1);
  }

  // ── 1. Pull / clone source into INSTALL_DIR ─────────────────────────────
  const gitDir = path.join(INSTALL_DIR, ".git");
  if (fs.existsSync(gitDir)) {
    printColor("Step 1/6: Pulling latest changes from git...", "36");
    try {
      execSync("git pull", { cwd: INSTALL_DIR, stdio: "inherit" });
    } catch (e) {
      console.error("Git pull failed:", e.message);
      process.exit(1);
    }
  } else {
    printColor("Step 1/6: Cloning from GitHub (no git repo found)...", "36");
    const backupDir = INSTALL_DIR + ".bak";
    try {
      // Backup existing files, clone fresh, then restore roles
      if (fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }
      fs.renameSync(INSTALL_DIR, backupDir);
      execSync(`git clone "${REPO_URL}" "${INSTALL_DIR}"`, { stdio: "inherit" });
      // Restore roles if they existed in backup
      const backupRoles = path.join(backupDir, "roles");
      const installRoles = path.join(INSTALL_DIR, "roles");
      if (fs.existsSync(backupRoles) && !fs.existsSync(installRoles)) {
        copyDir(backupRoles, installRoles);
      }
      fs.rmSync(backupDir, { recursive: true, force: true });
    } catch (e) {
      // Restore backup on failure so INSTALL_DIR is not left missing
      if (fs.existsSync(backupDir) && !fs.existsSync(INSTALL_DIR)) {
        fs.renameSync(backupDir, INSTALL_DIR);
      }
      console.error("Git clone failed:", e.message);
      console.error("Restored previous installation from backup.");
      process.exit(1);
    }
  }

  // ── 2. Rebuild MCP server ──────────────────────────────────────────────
  printColor("\nStep 2/6: Rebuilding MCP server...", "36");
  try {
    execSync("npm install", { cwd: INSTALL_DIR, stdio: "inherit" });
    execSync("npm run build", { cwd: INSTALL_DIR, stdio: "inherit" });
  } catch (e) {
    console.error("Build failed:", e.message);
    process.exit(1);
  }

  // ── 3. Detect what is installed ─────────────────────────────────────────
  printColor("\nStep 3/6: Detecting installed components...", "36");

  const installedIdes = detectInstalledIdes();
  const hasPubSkills = hasPublicSkillsInstalled();
  const hasBehSkills = hasBehavioralSkillsInstalled();
  const hasRoles = hasRolesInstalled();
  const hasBin = hasBinWrapper();

  // Always-update core items
  const coreItems = [];
  if (hasRoles) coreItems.push("Roles");
  if (hasPubSkills) coreItems.push("Public skills (super-orchestrator, caveman)");
  if (hasBehSkills) coreItems.push("Behavioral skills (MCP-only)");
  if (hasBin) coreItems.push("CLI wrapper (superagents-mcp)");

  if (installedIdes.length === 0 && coreItems.length === 0) {
    console.error("\nNo installed components detected. Nothing to update.");
    process.exit(0);
  }

  // ── 4. Interactive selection ────────────────────────────────────────────
  printColor("\nStep 4/6: Select components to update\n", "36");

  // Build choices: core items first, then IDEs
  const choices = [];

  if (coreItems.length > 0) {
    choices.push({
      title: `Core components (${coreItems.join(", ")})`,
      value: "core",
      selected: true,
    });
  }

  const ideLabels = {
    "claude-desktop": "Claude Desktop",
    "claude-code": "Claude Code",
    "github-copilot": "GitHub Copilot (VS Code)",
    "cline": "Cline (VS Code)",
    "roocode": "RooCode (VS Code)",
    "cursor": "Cursor",
    "windsurf": "Windsurf",
    "opencode": "OpenCode",
    "qwen": "Qwen",
    "continue": "Continue.dev",
    "zed": "Zed",
  };

  for (const { ide, hasMcp, hasAgent } of installedIdes) {
    const details = [];
    if (hasMcp) details.push("MCP");
    if (hasAgent) details.push("Agent/Workflow");
    choices.push({
      title: `${ideLabels[ide] || ide} [${details.join(" + ")}]`,
      value: ide,
      selected: true,
    });
  }

  const selectResult = await prompts({
    type: "multiselect",
    name: "items",
    message: "Select components to update (Space to toggle, Enter to confirm)",
    choices,
    hint: "- Space to toggle. Return to submit",
    instructions: false,
  });

  if (!selectResult.items || selectResult.items.length === 0) {
    printColor("\nNo components selected. Update cancelled.", "33");
    process.exit(0);
  }

  const selected = selectResult.items;
  const updateCore = selected.includes("core");
  const updateIdes = selected.filter((s) => s !== "core");

  // ── 5. Warning & confirmation ───────────────────────────────────────────
  printColor("\nStep 5/6: Confirmation\n", "1;33");

  printColor("⚠  WARNING: All selected components will be replaced with latest versions.", "1;33");
  printColor("   Any custom changes you made to roles, skills, workflows, or agent", "1;33");
  printColor("   configurations will be OVERWRITTEN.\n", "1;33");

  // Show what will be updated
  const updateList = [];
  if (updateCore) {
    if (hasRoles) updateList.push("  • Roles → " + path.join(INSTALL_DIR, "roles"));
    if (hasPubSkills) updateList.push("  • Public skills → " + AGENTS_SKILLS_DIR);
    if (hasBehSkills) updateList.push("  • Behavioral skills → " + PRIVATE_SKILLS_DIR);
    if (hasBin) updateList.push("  • CLI wrapper → " + getBinDir());
  }
  for (const ide of updateIdes) {
    const mcpPath = getMcpSettingsPath(ide);
    const agentDest = getAgentDest(ide);
    if (mcpPath) updateList.push(`  • ${ideLabels[ide]} MCP config → ${mcpPath}`);
    if (agentDest) updateList.push(`  • ${ideLabels[ide]} Agent/Workflow → ${agentDest}`);
  }

  printColor("Will update:\n" + updateList.join("\n"), "36");

  const confirmResult = await prompts({
    type: "confirm",
    name: "proceed",
    message: "Proceed with update? All custom changes will be lost.",
    initial: false,
  });

  if (!confirmResult.proceed) {
    printColor("\nUpdate cancelled.", "33");
    process.exit(0);
  }

  // ── 6. Execute updates ──────────────────────────────────────────────────
  printColor("\nStep 6/6: Updating...\n", "36");

  // 6a. Core components
  if (updateCore) {
    // Roles
    if (hasRoles && fs.existsSync(ROLES_SOURCE)) {
      const installRolesDir = path.join(INSTALL_DIR, "roles");
      copyDir(ROLES_SOURCE, installRolesDir);
      console.log("✓ Roles updated");
    }

    // Public skills → ~/.agents/skills/
    if (hasPubSkills) {
      ensureDir(AGENTS_SKILLS_DIR);
      for (const skillName of PUBLIC_SKILLS) {
        const src = path.join(SKILLS_SOURCE, skillName);
        if (fs.existsSync(src)) {
          copyDir(src, path.join(AGENTS_SKILLS_DIR, skillName));
          console.log(`✓ Public skill updated: ${skillName}`);
        }
      }
    }

    // Behavioral skills → ~/.superpowers-orchestrator/skills/behavioral/
    if (hasBehSkills) {
      ensureDir(PRIVATE_SKILLS_DIR);
      const behavioralSource = path.join(SKILLS_SOURCE, "behavioral");
      if (fs.existsSync(behavioralSource)) {
        const entries = fs.readdirSync(behavioralSource, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          copyDir(
            path.join(behavioralSource, entry.name),
            path.join(PRIVATE_SKILLS_DIR, entry.name)
          );
        }
        console.log(`✓ Behavioral skills updated (${entries.filter(e => e.isDirectory()).length} skills)`);
      }
    }

    // CLI wrapper
    if (hasBin) {
      const binDir = getBinDir();
      ensureDir(binDir);
      const serverPath = path.join(INSTALL_DIR, "dist", "index.js");
      const platform = os.platform();
      if (platform === "win32") {
        const cmdPath = path.join(binDir, "superagents-mcp.cmd");
        fs.writeFileSync(cmdPath, `@echo off\nnode "${serverPath}" %*\n`);
      } else {
        const shPath = path.join(binDir, "superagents-mcp");
        fs.writeFileSync(shPath, `#!/usr/bin/env sh\nexec node "${serverPath}" "$@"\n`);
        fs.chmodSync(shPath, 0o755);
      }
      console.log("✓ CLI wrapper updated");
    }
  }

  // 6b. Per-IDE updates
  for (const ide of updateIdes) {
    const installed = installedIdes.find((i) => i.ide === ide);
    if (!installed) continue;

    // MCP config
    if (installed.hasMcp) {
      if (updateMcpConfig(ide)) {
        console.log(`✓ ${ideLabels[ide]}: MCP config updated`);
      }
    }

    // Agent files
    if (installed.hasAgent) {
      const agentSrcDir = getAgentSourceDir(ide);
      const agentDestDir = getAgentDest(ide);
      if (agentSrcDir && agentDestDir && fs.existsSync(agentSrcDir)) {
        ensureDir(agentDestDir);
        const files = fs.readdirSync(agentSrcDir);
        for (const file of files) {
          fs.copyFileSync(
            path.join(agentSrcDir, file),
            path.join(agentDestDir, file)
          );
        }
        console.log(`✓ ${ideLabels[ide]}: Agent files updated`);
      }
    }

  }

  // ── Done ────────────────────────────────────────────────────────────────
  printColor("\n=== Update Complete ===", "1;32");
  printColor("Restart your IDE(s) to reload the MCP server and updated components.", "33");
}

main().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
