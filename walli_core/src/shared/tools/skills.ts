import type { ToolConfig } from "../const";

export const skillsTool = {
  enabled: true,
  name: "skills",
  description: "Browse or search this client's skills using query (empty to browse). Supply skillId to read a skill's instructions instead. Use nextOffset to continue; repeated content is not returned twice.",
  invocation: { type: "api", url: "/api/tools/skills", method: "POST", headers: [] },
  schema: { fields: [
    { name: "skillId", type: "string", description: "Skill ID to read. Omit to search or browse the catalog.", required: false, defaultValue: "" },
    { name: "query", type: "string", description: "Search keywords; omit or leave empty to browse. Only used without skillId.", required: false, defaultValue: "" },
    { name: "offset", type: "number", description: "Use nextOffset to continue: character offset when reading, result offset when searching.", required: false, defaultValue: "0" },
  ] },
} satisfies ToolConfig;
