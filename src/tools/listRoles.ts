import { IndexBuilder } from "../utils/indexBuilder.js";
import type { RoleMeta } from "../types/role.js";

export interface ListRolesInput {
  filter?: string;
  domain?: string;
  tags?: string[];
}

export function listRoles(index: IndexBuilder, input: ListRolesInput = {}): RoleMeta[] {
  let roles = index.listRoles();

  if (input.filter) {
    const f = input.filter.toLowerCase();
    roles = roles.filter(
      (r) =>
        r.id.toLowerCase().includes(f) ||
        r.name.toLowerCase().includes(f) ||
        r.description.toLowerCase().includes(f)
    );
  }

  if (input.domain) {
    const d = input.domain.toLowerCase();
    roles = roles.filter((r) => r.domains.some((dom) => dom.toLowerCase() === d));
  }

  if (input.tags && input.tags.length > 0) {
    const tags = input.tags.map((t) => t.toLowerCase());
    roles = roles.filter((r) =>
      tags.some((tag) => r.tags.some((rt) => rt.toLowerCase() === tag))
    );
  }

  return roles;
}
