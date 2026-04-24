import type { SkillIndex, SkillMeta } from "../utils/skillIndex.js";

export function listSkills(index: SkillIndex): SkillMeta[] {
  return index.listSkills();
}
