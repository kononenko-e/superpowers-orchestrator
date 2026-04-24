import path from "node:path";
import os from "node:os";

export interface Config {
  rolesPath: string;
  skillsPath: string;
}

function expandHome(filepath: string): string {
  if (filepath.startsWith("~/") || filepath === "~") {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

export function getConfig(): Config {
  const rolesPath = process.env.SUPERPOWERS_ROLES_PATH
    ? expandHome(process.env.SUPERPOWERS_ROLES_PATH)
    : path.join(os.homedir(), ".superpowers-orchestrator", "roles");

  const skillsPath = process.env.SUPERPOWERS_SKILLS_PATH
    ? expandHome(process.env.SUPERPOWERS_SKILLS_PATH)
    : path.join(os.homedir(), ".superpowers-orchestrator", "skills", "behavioral");

  return { rolesPath, skillsPath };
}
