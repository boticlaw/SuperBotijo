import { scanAllSkills } from "@/lib/skill-parser";
import { listInstalledSkills } from "@/lib/skills-installer";
import SkillsClient, { type Skill } from "./SkillsClient";

export const dynamic = "force-dynamic";

async function getSkillsInitialData(): Promise<{ skills: Skill[] }> {
  try {
    const scannedSkills = scanAllSkills();
    const installedSkills = await listInstalledSkills();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skillsMap = new Map<string, any>();
    
    for (const skill of scannedSkills) {
      skillsMap.set(skill.id, {
        ...skill,
        installed: true,
      });
    }
    
    for (const skill of installedSkills) {
      if (skillsMap.has(skill.id)) {
        const existing = skillsMap.get(skill.id);
        skillsMap.set(skill.id, {
          ...existing,
          ...skill,
          installed: true,
        });
      } else {
        skillsMap.set(skill.id, {
          ...skill,
          installed: true,
        });
      }
    }

    return {
      skills: Array.from(skillsMap.values()),
    };
  } catch (error) {
    console.error("Failed to list skills:", error);
    return { skills: [] };
  }
}

export default async function SkillsPage() {
  const initialData = await getSkillsInitialData();
  return <SkillsClient initialData={initialData} />;
}
