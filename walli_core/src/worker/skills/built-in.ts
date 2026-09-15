import customBlocksReadme from "../../../../walli_chat_blocks/README.md?raw";

export const BUILT_IN_SKILLS = [{
  id: "4ff0690d-7b71-47db-92ce-1b386a0fe74d",
  key: "custom-blocks",
  platforms: ["web"],
  name: "Custom Block Rendering",
  description: "Use when a web chat response benefits from recommended replies, notices, or confirmation cards.",
  content: customBlocksReadme,
}];


export const clientSkillSettingsKey = (clientId: string) => `client:${clientId}:skill-settings`;

export const getBuiltInClientSkills = (
  clientId: string,
  platform: string,
  settings: Record<string, boolean> | null,
  legacy: ReadonlyArray<{ builtInKey: string | null; enabled: boolean }>,
) => BUILT_IN_SKILLS.filter((skill) => skill.platforms.includes(platform)).map((skill) => ({
  id: skill.id,
  clientId,
  builtInKey: skill.key,
  name: skill.name,
  description: skill.description,
  content: skill.content,
  enabled: settings?.[skill.key] ?? legacy.find((item) => item.builtInKey === skill.key)?.enabled ?? true,
  createdAt: 0,
  updatedAt: 0,
}));
