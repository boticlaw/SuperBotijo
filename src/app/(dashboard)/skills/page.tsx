import { listMergedSkills } from "@/operations/skills-ops";
import SkillsClient, { type Skill } from "./SkillsClient";

export const dynamic = "force-dynamic";

async function getSkillsInitialData(): Promise<{ skills: Skill[] }> {
  try {
    const skills = await listMergedSkills();
    return {
      skills: skills as Skill[],
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
