import { IndexBuilder } from "../utils/indexBuilder.js";
import type { Role } from "../types/role.js";

export interface GetRoleInput {
  role_id: string;
}

export function getRole(index: IndexBuilder, input: GetRoleInput): Role | undefined {
  return index.getRole(input.role_id);
}
