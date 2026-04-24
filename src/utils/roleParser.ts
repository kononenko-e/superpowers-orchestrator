import YAML from "yaml";
import type { ParsedRole, RoleMeta } from "../types/role.js";

/**
 * Parse a role markdown file with YAML frontmatter.
 * Expected format:
 * ---
 * id: role-id
 * name: Role Name
 * description: Description
 * domains:
 *   - domain1
 * tags:
 *   - tag1
 * version: "1.0"
 * ---
 * # Content
 * ...
 */
export function parseRoleFile(filePath: string, content: string): ParsedRole {
  const trimmed = content.trim();

  if (!trimmed.startsWith("---")) {
    throw new Error(`Invalid role file ${filePath}: missing YAML frontmatter`);
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    throw new Error(`Invalid role file ${filePath}: unclosed YAML frontmatter`);
  }

  const yamlContent = trimmed.slice(3, endIndex).trim();
  const markdownContent = trimmed.slice(endIndex + 3).trim();

  const parsed = YAML.parse(yamlContent) as Record<string, unknown>;

  // Derive id from filename if not present in frontmatter
  const fileName = filePath.split(/[\\/]/).pop() ?? "";
  const fileId = fileName.replace(/\.md$/, "");

  const meta: RoleMeta = {
    id: String(parsed.id ?? fileId),
    name: String(parsed.name ?? ""),
    description: String(parsed.description ?? ""),
    domains: Array.isArray(parsed.domains)
      ? parsed.domains.map((d) => String(d))
      : [],
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.map((t) => String(t))
      : [],
    version: String(parsed.version ?? "1.0"),
  };

  if (!meta.id) {
    throw new Error(`Invalid role file ${filePath}: missing 'id' in frontmatter`);
  }

  return {
    frontmatter: meta,
    content: markdownContent,
  };
}
