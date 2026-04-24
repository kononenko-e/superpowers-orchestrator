#!/usr/bin/env node

/**
 * Cross-platform installer for superpowers-orchestrator
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const REPO_URL = "https://github.com/kononenko/superpowers-orchestrator.git";
const INSTALL_DIR = path.join(os.homedir(), ".superpowers-orchestrator");
const ROLES_SOURCE = path.join(process.cwd(), "roles");
const SKILLS_SOURCE = path.join(process.cwd(), "skills");
const AGENTS_SKILLS_DIR = path.join(os.homedir(), ".agents", "skills");
const PRIVATE_SKILLS_DIR = path.join(INSTALL_DIR, "skills", "behavioral");

// Skills exposed to the IDE/agent UI globally.
const PUBLIC_SKILLS = new Set(["super-orchestrator", "caveman"]);

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

function getNodeVersion() {
  try {
    const v = process.version.slice(1);
    const major = parseInt(v.split(".")[0], 10);
    return major;
  } catch {
    return 0;
  }
}

function detectIde() {
  if (process.env.CLINE_PATH || fs.existsSync(path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev"))) {
    return "cline";
  }
  if (process.env.ROO_CODE_PATH || fs.existsSync(path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline"))) {
    return "roocode";
  }
  return null;
}

function getMcpSettingsPath(ide) {
  const base = path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage");
  if (ide === "cline") {
    return path.join(base, "saoudrizwan.claude-dev/settings/cline_mcp_settings.json");
  }
  if (ide === "roocode") {
    return path.join(base, "rooveterinaryinc.roo-cline/settings/mcp_settings.json");
  }
  return null;
}

function getBinDir() {
  const platform = os.platform();
  if (platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), "superpowers-orchestrator");
  }
  const localBin = path.join(os.homedir(), ".local", "bin");
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return "/usr/local/bin";
}

function createBinWrapper(binDir) {
  const platform = os.platform();
  const serverPath = path.join(INSTALL_DIR, "dist", "index.js");

  if (platform === "win32") {
    const cmdPath = path.join(binDir, "superagents-mcp.cmd");
    const cmd = `@echo off\nnode "${serverPath}" %*\n`;
    fs.writeFileSync(cmdPath, cmd);
    return cmdPath;
  } else {
    const shPath = path.join(binDir, "superagents-mcp");
    const sh = `#!/usr/bin/env sh\nexec node "${serverPath}" "$@"\n`;
    fs.writeFileSync(shPath, sh);
    fs.chmodSync(shPath, 0o755);
    return shPath;
  }
}

function addMcpConfig(settingsPath) {
  let config = {};
  if (fs.existsSync(settingsPath)) {
    try {
      config = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    } catch {
      config = {};
    }
  }

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers["superagents-mcp"] = {
    command: "superagents-mcp",
    args: [],
    env: {
      SUPERPOWERS_ROLES_PATH: path.join(INSTALL_DIR, "roles"),
      SUPERPOWERS_SKILLS_PATH: PRIVATE_SKILLS_DIR,
    },
  };

  ensureDir(path.dirname(settingsPath));
  fs.writeFileSync(settingsPath, JSON.stringify(config, null, 2));
  return settingsPath;
}

function printColor(text, color = "36") {
  console.log(`\x1b[${color}m%s\x1b[0m`, text);
}

async function main() {
  printColor("=== Superpowers Orchestrator Installer ===\n", "1;36");

  const nodeMajor = getNodeVersion();
  if (nodeMajor < 18) {
    console.error("Error: Node.js >= 18 required. Found:", process.version);
    process.exit(1);
  }
  console.log("✓ Node.js:", process.version);

  const platform = os.platform();
  console.log("✓ OS:", platform);

  ensureDir(INSTALL_DIR);
  console.log("✓ Install dir:", INSTALL_DIR);

  const cwd = process.cwd();
  const isSourceInstall = fs.existsSync(path.join(cwd, "src", "index.ts"));

  if (isSourceInstall) {
    console.log("Installing from source...");
    copyDir(cwd, INSTALL_DIR);
  } else {
    console.log("Cloning from repository...");
    try {
      execSync(`git clone "${REPO_URL}" "${INSTALL_DIR}"`, { stdio: "inherit" });
    } catch (e) {
      console.error("Failed to clone repository:", e.message);
      process.exit(1);
    }
  }

  console.log("\nBuilding MCP server...");
  try {
    execSync("npm install", { cwd: INSTALL_DIR, stdio: "inherit" });
    execSync("npm run build", { cwd: INSTALL_DIR, stdio: "inherit" });
  } catch (e) {
    console.error("Build failed:", e.message);
    process.exit(1);
  }

  const binDir = getBinDir();
  ensureDir(binDir);
  const binPath = createBinWrapper(binDir);
  console.log("✓ CLI wrapper:", binPath);

  const installRolesDir = path.join(INSTALL_DIR, "roles");
  if (!fs.existsSync(installRolesDir) || fs.readdirSync(installRolesDir).length === 0) {
    if (fs.existsSync(ROLES_SOURCE)) {
      copyDir(ROLES_SOURCE, installRolesDir);
      console.log("✓ Roles copied from:", ROLES_SOURCE);
    }
  }

  // Install skills
  ensureDir(AGENTS_SKILLS_DIR);
  ensureDir(PRIVATE_SKILLS_DIR);

  // Copy public skills to global agents dir
  for (const skillName of PUBLIC_SKILLS) {
    const src = path.join(SKILLS_SOURCE, skillName);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(AGENTS_SKILLS_DIR, skillName));
      console.log("✓ Public skill installed:", skillName);
    }
  }

  // Copy behavioral skills to private MCP store
  const behavioralSource = path.join(SKILLS_SOURCE, "behavioral");
  if (fs.existsSync(behavioralSource)) {
    const entries = fs.readdirSync(behavioralSource, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      copyDir(
        path.join(behavioralSource, entry.name),
        path.join(PRIVATE_SKILLS_DIR, entry.name)
      );
      console.log("✓ Behavioral skill installed (MCP-only):", entry.name);
    }
  }

  const ide = detectIde();
  if (ide) {
    const settingsPath = getMcpSettingsPath(ide);
    if (settingsPath) {
      addMcpConfig(settingsPath);
      console.log("✓ MCP configured for", ide, "at", settingsPath);
    }
  } else {
    console.log("⚠ IDE not detected. Manual MCP configuration required.");
  }

  printColor("\n=== Installation Complete ===", "1;32");
  printColor("\nNext steps:", "1;33");
  if (ide === "cline") {
    printColor("1. Open Cline settings → Custom Instructions");
    printColor("2. Paste content from: " + path.join(INSTALL_DIR, "workflows/cline.md"));
  } else if (ide === "roocode") {
    printColor("1. Create Custom Mode in RooCode: superpowers-orchestrator");
    printColor("2. Paste content from: " + path.join(INSTALL_DIR, "workflows/roocode.md"));
  } else {
    printColor("1. Configure your IDE using workflow files in: " + path.join(INSTALL_DIR, "workflows/"));
  }
  printColor("\nRoles directory: " + installRolesDir);
  printColor("Public skills (IDE):   " + AGENTS_SKILLS_DIR);
  printColor("Private skills (MCP):  " + PRIVATE_SKILLS_DIR);
  printColor("\nTo update later: superagents-mcp --update\n");
}

main().catch((err) => {
  console.error("Installation failed:", err);
  process.exit(1);
});
