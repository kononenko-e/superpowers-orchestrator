import fs from "node:fs";
import path from "node:path";

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
}

export interface Skill extends SkillMeta {
  content: string;
}

/**
 * Indexes skills stored as <skillsPath>/<skill-id>/SKILL.md.
 * Frontmatter (`name`, `description`) is parsed loosely with a regex —
 * we only need a couple of fields, so a full YAML parser is overkill.
 */
export class SkillIndex {
  private skills = new Map<string, Skill>();

  constructor(private skillsPath: string) {}

  build(): void {
    this.skills.clear();

    if (!fs.existsSync(this.skillsPath)) {
      console.error(`Skills path does not exist: ${this.skillsPath}`);
      return;
    }

    const entries = fs.readdirSync(this.skillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(this.skillsPath, entry.name, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;

      try {
        const raw = fs.readFileSync(skillFile, "utf-8");
        const { name, description } = parseFrontmatter(raw);
        this.skills.set(entry.name, {
          id: entry.name,
          name: name || entry.name,
          description: description || "",
          content: raw,
        });
      } catch (err) {
        console.error(`Failed to parse skill ${entry.name}:`, err);
      }
    }
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  listSkills(): SkillMeta[] {
    return Array.from(this.skills.values()).map(({ id, name, description }) => ({
      id,
      name,
      description,
    }));
  }

  get count(): number {
    return this.skills.size;
  }
}

function parseFrontmatter(raw: string): { name?: string; description?: string } {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) return {};

  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return {};

  const block = trimmed.slice(3, end);
  const result: { name?: string; description?: string } = {};

  // Match `name:` and `description:` — tolerate quoted, unquoted, or `>-` block scalars
  const nameMatch = block.match(/^name:\s*(.+)$/m);
  if (nameMatch) result.name = stripQuotes(nameMatch[1].trim());

  const descMatch = block.match(/^description:\s*([\s\S]*?)(?=\n[a-zA-Z_]+:|\n*$)/m);
  if (descMatch) {
    let v = descMatch[1].trim();
    // Block scalar indicator
    if (v.startsWith(">-") || v.startsWith(">") || v.startsWith("|-") || v.startsWith("|")) {
      v = v.replace(/^[>|][-+]?\s*/, "");
    }
    result.description = stripQuotes(v.replace(/\s+/g, " ").trim());
  }

  return result;
}

function stripQuotes(v: string): string {
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}
