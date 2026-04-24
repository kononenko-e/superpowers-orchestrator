import fs from "node:fs";
import path from "node:path";
import { parseRoleFile } from "./roleParser.js";
import type { Role, RoleMeta } from "../types/role.js";

export class IndexBuilder {
  private roles = new Map<string, Role>();
  private metaList: RoleMeta[] = [];
  private domains = new Set<string>();

  constructor(private rolesPath: string) {}

  build(): void {
    this.roles.clear();
    this.metaList = [];
    this.domains.clear();

    if (!fs.existsSync(this.rolesPath)) {
      console.error(`Roles path does not exist: ${this.rolesPath}`);
      return;
    }

    this.scanDirectory(this.rolesPath);
  }

  private scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        this.scanDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        this.parseFile(fullPath);
      }
    }
  }

  private parseFile(filePath: string): void {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = parseRoleFile(filePath, raw);

      const role: Role = {
        ...parsed.frontmatter,
        content: parsed.content,
      };

      this.roles.set(role.id, role);
      this.metaList.push(parsed.frontmatter);

      for (const domain of parsed.frontmatter.domains) {
        this.domains.add(domain);
      }
    } catch (err) {
      console.error(`Failed to parse role file ${filePath}:`, err);
    }
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id);
  }

  listRoles(): RoleMeta[] {
    return [...this.metaList];
  }

  getDomains(): string[] {
    return Array.from(this.domains).sort();
  }

  get count(): number {
    return this.roles.size;
  }
}
