/**
 * Branding Configuration
 * 
 * Customize this file to match your instance's branding.
 * This keeps personal/instance-specific data out of the main codebase.
 */

export const BRANDING = {
  // Main agent name and emoji
  agentName: process.env.NEXT_PUBLIC_AGENT_NAME || "SuperBotijo",
  agentEmoji: process.env.NEXT_PUBLIC_AGENT_EMOJI || "🫙",

  // About page — agent identity
  agentLocation: process.env.NEXT_PUBLIC_AGENT_LOCATION || "",
  birthDate: process.env.NEXT_PUBLIC_BIRTH_DATE || "",          // ISO date, e.g. "2026-01-01"
  agentAvatar: process.env.NEXT_PUBLIC_AGENT_AVATAR || "",      // path under /public, e.g. "/avatar.jpg"
  agentDescription: process.env.NEXT_PUBLIC_AGENT_DESCRIPTION || "", // one-line description

  // User/owner information (optional - used in workflow descriptions)
  ownerUsername: process.env.NEXT_PUBLIC_OWNER_USERNAME || "your-username",
  ownerEmail: process.env.NEXT_PUBLIC_OWNER_EMAIL || "owner@example.com",
  ownerCollabEmail: process.env.NEXT_PUBLIC_OWNER_COLLAB_EMAIL || "collabs@example.com",

  // Social media handles (optional - for workflow descriptions)
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@username",

  // Company/organization name (shown in office 3D view)
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || "MISSION CONTROL, INC.",

  // App title (shown in browser tab)
  appTitle: process.env.NEXT_PUBLIC_APP_TITLE || "SuperBotijo",
} as const;

// Helper to get full agent display name
export function getAgentDisplayName(): string {
  return BRANDING.agentName;
}
