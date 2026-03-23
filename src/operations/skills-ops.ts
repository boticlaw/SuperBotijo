import "server-only";

import { scanAllSkills, type SkillInfo } from "@/lib/skill-parser";
import { listInstalledSkills, type Skill as InstalledSkill } from "@/lib/skills-installer";

type MergedSkill = SkillInfo & Partial<InstalledSkill> & { installed: boolean };

function createFallbackScannedSkill(skill: InstalledSkill): SkillInfo {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    location: skill.location,
    source: "workspace",
    fileCount: 0,
    fullContent: "",
    files: [],
    agents: [],
  };
}

export function mergeSkills(scannedSkills: SkillInfo[], installedSkills: InstalledSkill[]): MergedSkill[] {
  const skillsMap = new Map<string, MergedSkill>();

  for (const skill of scannedSkills) {
    skillsMap.set(skill.id, {
      ...skill,
      installed: true,
    });
  }

  for (const skill of installedSkills) {
    const existing = skillsMap.get(skill.id);
    skillsMap.set(skill.id, {
      ...(existing || ({
        ...createFallbackScannedSkill(skill),
      })),
      ...skill,
      installed: true,
    });
  }

  return Array.from(skillsMap.values());
}

export async function listMergedSkills(): Promise<MergedSkill[]> {
  const scannedSkills = scanAllSkills();
  const installedSkills = await listInstalledSkills();
  return mergeSkills(scannedSkills, installedSkills);
}
