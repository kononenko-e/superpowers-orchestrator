#!/usr/bin/env node

/**
 * Cross-platform installer for superpowers-orchestrator
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import prompts from "prompts";

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

function copyDir(src, dest, excludeDirs = []) {
  ensureDir(dest);
  
  // Handle symlinks: resolve and copy target
  const stats = fs.lstatSync(src);
  if (stats.isSymbolicLink()) {
    const target = fs.readlinkSync(src);
    const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(src), target);
    if (fs.existsSync(resolvedTarget)) {
      copyDir(resolvedTarget, dest, excludeDirs);
    }
    return;
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    // Skip excluded directories
    if (excludeDirs.includes(entry.name)) {
      continue;
    }
    
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludeDirs);
    } else if (entry.isSymbolicLink()) {
      // Handle symlinked files
      const target = fs.readlinkSync(srcPath);
      const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(srcPath), target);
      if (fs.existsSync(resolvedTarget)) {
        fs.copyFileSync(resolvedTarget, destPath);
      }
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
  const detected = [];
  
  // Claude Desktop
  const claudeConfigPath = getClaudeDesktopConfigPath();
  if (claudeConfigPath && fs.existsSync(claudeConfigPath)) {
    detected.push("claude-desktop");
  }
  
  // Cline
  if (process.env.CLINE_PATH || fs.existsSync(path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev"))) {
    detected.push("cline");
  }
  
  // RooCode
  if (process.env.ROO_CODE_PATH || fs.existsSync(path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline"))) {
    detected.push("roocode");
  }
  
  return detected;
}

function getClaudeDesktopConfigPath() {
  const platform = os.platform();
  if (platform === "darwin") {
    return path.join(os.homedir(), "Library/Application Support/Claude/claude_desktop_config.json");
  } else if (platform === "win32") {
    return path.join(os.homedir(), "AppData/Roaming/Claude/claude_desktop_config.json");
  } else {
    return path.join(os.homedir(), ".config/Claude/claude_desktop_config.json");
  }
}

function getMcpSettingsPath(ide) {
  if (ide === "claude-desktop") {
    return getClaudeDesktopConfigPath();
  }
  
  const base = path.join(os.homedir(), "Library/Application Support/Code/User/globalStorage");
  if (ide === "cline") {
    return path.join(base, "saoudrizwan.claude-dev/settings/cline_mcp_settings.json");
  }
  if (ide === "roocode") {
    return path.join(base, "rooveterinaryinc.roo-cline/settings/mcp_settings.json");
  }
  return null;
}

async function selectIde(detectedIdes) {
  const choices = [
    { title: "Claude Desktop", value: "claude-desktop", selected: detectedIdes.includes("claude-desktop") },
    { title: "Cline (VS Code)", value: "cline", selected: detectedIdes.includes("cline") },
    { title: "RooCode (VS Code)", value: "roocode", selected: detectedIdes.includes("roocode") },
  ];
  
  const response = await prompts({
    type: "multiselect",
    name: "ides",
    message: "Select MCP clients to configure (Space to select, Enter to confirm)",
    choices: choices,
    hint: "- Space to select. Return to submit",
    instructions: false,
  });
  
  if (!response.ides || response.ides.length === 0) {
    const showManual = await prompts({
      type: "confirm",
      name: "value",
      message: "No IDE selected. Show manual configuration?",
      initial: true,
    });
    
    return showManual.value ? ["manual"] : ["skip"];
  }
  
  return response.ides;
}

function printManualConfig() {
  const config = {
    mcpServers: {
      "superagents-mcp": {
        command: "superagents-mcp",
        args: [],
        env: {
          SUPERPOWERS_ROLES_PATH: path.join(INSTALL_DIR, "roles"),
          SUPERPOWERS_SKILLS_PATH: PRIVATE_SKILLS_DIR,
        },
      },
    },
  };
  
  console.log("\n\x1b[1;36m=== Manual MCP Configuration ===\x1b[0m");
  console.log("\nAdd this to your MCP client config file:\n");
  console.log(JSON.stringify(config, null, 2));
  console.log("\n\x1b[36mConfig file locations:\x1b[0m");
  console.log("  Claude Desktop: " + getClaudeDesktopConfigPath());
  console.log("  Cline: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json");
  console.log("  RooCode: ~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json");
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
    copyDir(cwd, INSTALL_DIR, ['.git', 'node_modules', 'dist', 'roles']);
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
    let count = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      copyDir(
        path.join(behavioralSource, entry.name),
        path.join(PRIVATE_SKILLS_DIR, entry.name)
      );
      count++;
    }
    console.log(`✓ Behavioral skills installed (MCP-only): ${count} skills`);
  }

  const detectedIdes = detectIde();
  const selectedIdes = await selectIde(detectedIdes);
  
  if (selectedIdes.includes("skip")) {
    console.log("⚠ Skipping MCP configuration.");
  } else if (selectedIdes.includes("manual")) {
    printManualConfig();
  } else if (selectedIdes.length > 0) {
    for (const ide of selectedIdes) {
      const settingsPath = getMcpSettingsPath(ide);
      if (settingsPath) {
        addMcpConfig(settingsPath);
        console.log("✓ MCP configured for", ide, "at", settingsPath);
      } else {
        console.log("⚠ Could not determine config path for", ide);
      }
    }
  } else {
    console.log("⚠ No IDE selected.");
  }

  printColor("\n=== Installation Complete ===", "1;32");
  printColor("\nNext steps:", "1;33");
  
  if (selectedIdes.includes("manual")) {
    printColor("1. Add the configuration shown above to your MCP client");
    printColor("2. Restart your MCP client");
  } else if (selectedIdes.includes("skip") || selectedIdes.length === 0) {
    printColor("1. Configure your IDE using workflow files in: " + path.join(INSTALL_DIR, "workflows/"));
  } else {
    if (selectedIdes.includes("cline")) {
      printColor("\nCline:");
      printColor("  1. Open Cline settings → Custom Instructions");
      printColor("  2. Paste content from: " + path.join(INSTALL_DIR, "workflows/cline.md"));
    }
    if (selectedIdes.includes("roocode")) {
      printColor("\nRooCode:");
      printColor("  1. Create Custom Mode: superpowers-orchestrator");
      printColor("  2. Paste content from: " + path.join(INSTALL_DIR, "workflows/roocode.md"));
    }
    if (selectedIdes.includes("claude-desktop")) {
      printColor("\nClaude Desktop:");
      printColor("  1. Restart Claude Desktop to load the MCP server");
      printColor("  2. Check available tools in Claude Desktop");
    }
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
