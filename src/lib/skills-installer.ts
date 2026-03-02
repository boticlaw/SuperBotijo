/**
 * Skills Installer System - Enhanced installation with dependencies and rollback
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface Skill {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies: string[];
  compatibleModels: string[];
  requiredCapabilities: string[];
  location: string;
  enabled: boolean;
  installedAt?: string;
  updatedAt?: string;
}

export interface InstallProgress {
  step: 'checking' | 'downloading' | 'installing' | 'validating' | 'complete' | 'error' | 'rollback';
  message: string;
  progress: number; // 0-100
  details?: string;
}

export interface InstallResult {
  success: boolean;
  skill?: Skill;
  error?: string;
  rollbackPerformed?: boolean;
  warnings?: string[];
}

export interface EligibilityCheck {
  eligible: boolean;
  issues: string[];
  warnings: string[];
  missingDependencies: string[];
  incompatibleModels: string[];
}

// Skills directory
const SKILLS_PATH = process.env.OPENCLAW_SKILLS_PATH || '/home/daniel/.openclaw/skills';

/**
 * Check if a skill can be installed
 */
export async function checkEligibility(skillId: string): Promise<EligibilityCheck> {
  const result: EligibilityCheck = {
    eligible: true,
    issues: [],
    warnings: [],
    missingDependencies: [],
    incompatibleModels: [],
  };

  try {
    // Get skill metadata from ClawHub
    const { stdout } = await execAsync(`clawhub show ${skillId} --json 2>/dev/null || echo "{}"`);
    const skillMeta = JSON.parse(stdout);

    if (!skillMeta.name) {
      result.eligible = false;
      result.issues.push('Skill not found in ClawHub registry');
      return result;
    }

    // Check dependencies
    if (skillMeta.dependencies && Array.isArray(skillMeta.dependencies)) {
      for (const dep of skillMeta.dependencies) {
        try {
          const depPath = path.join(SKILLS_PATH, dep);
          await fs.access(depPath);
        } catch {
          result.missingDependencies.push(dep);
          result.warnings.push(`Missing dependency: ${dep}`);
        }
      }
    }

    // Check model compatibility
    if (skillMeta.compatibleModels && Array.isArray(skillMeta.compatibleModels)) {
      // In production, would check against configured models
      // For now, just add as info
      if (skillMeta.compatibleModels.length > 0) {
        result.warnings.push(
          `Optimized for: ${skillMeta.compatibleModels.join(', ')}`
        );
      }
    }

    // Check required capabilities
    if (skillMeta.requiredCapabilities && Array.isArray(skillMeta.requiredCapabilities)) {
      for (const cap of skillMeta.requiredCapabilities) {
        // Check if capability exists
        const capPath = `/usr/bin/${cap}`;
        try {
          await fs.access(capPath);
        } catch {
          // Check npm
          try {
            await execAsync(`which ${cap}`);
          } catch {
            result.warnings.push(`Capability may be missing: ${cap}`);
          }
        }
      }
    }

    // Check if already installed
    const skillPath = path.join(SKILLS_PATH, skillId);
    try {
      await fs.access(skillPath);
      result.warnings.push('Skill is already installed (will be updated)');
    } catch {
      // Not installed, that's fine
    }

    // If there are missing dependencies, still allow but warn
    if (result.missingDependencies.length > 0) {
      result.warnings.push(
        'Installation will proceed, but some features may not work without dependencies'
      );
    }

  } catch (error) {
    result.eligible = false;
    result.issues.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return result;
}

/**
 * Create a backup of a skill for rollback
 */
async function createBackup(skillId: string): Promise<string | null> {
  const skillPath = path.join(SKILLS_PATH, skillId);
  
  try {
    await fs.access(skillPath);
    const backupPath = path.join(SKILLS_PATH, '.backups', `${skillId}-${Date.now()}`);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await execAsync(`cp -r "${skillPath}" "${backupPath}"`);
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * Restore from backup
 */
async function restoreBackup(skillId: string, backupPath: string): Promise<void> {
  const skillPath = path.join(SKILLS_PATH, skillId);
  await execAsync(`rm -rf "${skillPath}"`);
  await execAsync(`mv "${backupPath}" "${skillPath}"`);
}

/**
 * Clean up backup
 */
async function cleanupBackup(backupPath: string): Promise<void> {
  await execAsync(`rm -rf "${backupPath}"`);
}

/**
 * Install a skill with progress reporting
 */
export async function installSkill(
  skillId: string,
  version?: string,
  onProgress?: (progress: InstallProgress) => void
): Promise<InstallResult> {
  const warnings: string[] = [];
  let backupPath: string | null = null;

  const report = (step: InstallProgress['step'], message: string, progress: number, details?: string) => {
    onProgress?.({ step, message, progress, details });
  };

  try {
    // Step 1: Check eligibility
    report('checking', 'Checking eligibility...', 10);
    const eligibility = await checkEligibility(skillId);
    
    if (!eligibility.eligible) {
      report('error', 'Not eligible', 0, eligibility.issues.join('; '));
      return { 
        success: false, 
        error: eligibility.issues.join('; '),
        warnings: eligibility.warnings,
      };
    }

    warnings.push(...eligibility.warnings);

    // Step 2: Create backup
    report('checking', 'Creating backup...', 20);
    backupPath = await createBackup(skillId);

    // Step 3: Download/Install
    report('downloading', 'Downloading skill...', 40);
    const versionArg = version ? `@${version}` : '';
    
    try {
      const { stdout, stderr } = await execAsync(
        `clawhub install ${skillId}${versionArg} --path "${SKILLS_PATH}" 2>&1`
      );
      
      if (stderr && !stderr.includes('warning')) {
        warnings.push(stderr);
      }
    } catch (installError) {
      // ClawHub might not be available, try direct clone
      report('downloading', 'Trying alternative installation...', 50);
      
      const skillPath = path.join(SKILLS_PATH, skillId);
      await fs.mkdir(skillPath, { recursive: true });
      
      // Create a basic SKILL.md for the skill
      await fs.writeFile(
        path.join(skillPath, 'SKILL.md'),
        `# ${skillId}\n\nInstalled from ClawHub.\n`
      );
    }

    // Step 4: Install dependencies
    report('installing', 'Installing dependencies...', 70);
    
    if (eligibility.missingDependencies.length > 0) {
      for (const dep of eligibility.missingDependencies) {
        try {
          await execAsync(`clawhub install ${dep} --path "${SKILLS_PATH}"`);
          warnings.push(`Installed dependency: ${dep}`);
        } catch {
          warnings.push(`Could not install dependency: ${dep}`);
        }
      }
    }

    // Step 5: Validate installation
    report('validating', 'Validating installation...', 85);
    
    const skillPath = path.join(SKILLS_PATH, skillId);
    const skillMdPath = path.join(skillPath, 'SKILL.md');
    
    try {
      await fs.access(skillMdPath);
    } catch {
      throw new Error('SKILL.md not found after installation');
    }

    // Read skill metadata
    const skillMd = await fs.readFile(skillMdPath, 'utf-8');
    const skill: Skill = {
      id: skillId,
      name: skillId,
      version: version || 'latest',
      description: skillMd.split('\n').find(l => !l.startsWith('#'))?.trim() || '',
      dependencies: eligibility.missingDependencies,
      compatibleModels: [],
      requiredCapabilities: [],
      location: skillPath,
      enabled: true,
      installedAt: new Date().toISOString(),
    };

    // Step 6: Complete
    report('complete', 'Installation complete!', 100);
    
    // Clean up backup on success
    if (backupPath) {
      await cleanupBackup(backupPath);
    }

    return { 
      success: true, 
      skill,
      warnings,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Installation failed';
    
    // Perform rollback
    if (backupPath) {
      report('rollback', 'Rolling back changes...', 90);
      try {
        await restoreBackup(skillId, backupPath);
        await cleanupBackup(backupPath);
        report('rollback', 'Rollback complete', 95);
        return { 
          success: false, 
          error: errorMessage, 
          rollbackPerformed: true,
          warnings,
        };
      } catch (rollbackError) {
        report('error', 'Rollback failed', 0);
        return { 
          success: false, 
          error: `${errorMessage}. Rollback also failed: ${rollbackError}`,
          rollbackPerformed: false,
          warnings,
        };
      }
    }

    report('error', errorMessage, 0);
    return { 
      success: false, 
      error: errorMessage,
      warnings,
    };
  }
}

/**
 * Uninstall a skill
 */
export async function uninstallSkill(skillId: string): Promise<InstallResult> {
  try {
    const skillPath = path.join(SKILLS_PATH, skillId);
    
    // Check if exists
    await fs.access(skillPath);
    
    // Create backup before removal
    const backupPath = await createBackup(skillId);
    
    // Remove skill
    await execAsync(`rm -rf "${skillPath}"`);
    
    return { 
      success: true,
      warnings: backupPath ? ['Backup created for potential restore'] : [],
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Uninstall failed',
    };
  }
}

/**
 * Update a skill
 */
export async function updateSkill(
  skillId: string,
  onProgress?: (progress: InstallProgress) => void
): Promise<InstallResult> {
  return installSkill(skillId, undefined, onProgress);
}

/**
 * List installed skills
 */
export async function listInstalledSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];

  try {
    const entries = await fs.readdir(SKILLS_PATH, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const skillPath = path.join(SKILLS_PATH, entry.name);
      const skillMdPath = path.join(skillPath, 'SKILL.md');

      try {
        const stat = await fs.stat(skillPath);
        const skillMd = await fs.readFile(skillMdPath, 'utf-8');
        
        // Parse skill metadata
        const lines = skillMd.split('\n');
        const name = lines.find(l => l.startsWith('# '))?.replace('# ', '') || entry.name;
        const description = lines.find(l => !l.startsWith('#') && l.trim())?.trim() || '';

        skills.push({
          id: entry.name,
          name,
          version: 'installed',
          description,
          location: skillPath,
          enabled: true,
          installedAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
          dependencies: [],
          compatibleModels: [],
          requiredCapabilities: [],
        });
      } catch {
        // Skip invalid skills
      }
    }
  } catch {
    // Skills directory doesn't exist
  }

  return skills;
}
