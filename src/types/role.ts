/**
 * Type definitions for role management
 */

export interface RoleMeta {
  id: string;
  name: string;
  description: string;
  domains: string[];
  tags: string[];
  version: string;
}

export interface Role extends RoleMeta {
  content: string;
}

export interface ParsedRole {
  frontmatter: RoleMeta;
  content: string;
}

export interface RoleIndex {
  roles: RoleMeta[];
  count: number;
}

export interface DomainList {
  domains: string[];
}
