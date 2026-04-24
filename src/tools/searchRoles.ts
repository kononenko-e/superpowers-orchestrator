import { IndexBuilder } from "../utils/indexBuilder.js";
import type { RoleMeta } from "../types/role.js";

export interface SearchRolesInput {
  query: string;
}

export function searchRoles(index: IndexBuilder, input: SearchRolesInput): RoleMeta[] {
  const q = input.query.toLowerCase();
  const roles = index.listRoles();

  return roles.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q)
  );
}
