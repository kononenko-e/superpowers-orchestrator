import type { SkillIndex, Skill } from "../utils/skillIndex.js";

export interface GetSkillInput {
  skill_id: string;
}

export function getSkill(index: SkillIndex, input: GetSkillInput): Skill | undefined {
  return index.getSkill(input.skill_id);
}
