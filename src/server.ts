import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
  type TextContent,
  type ServerCapabilities,
} from "@modelcontextprotocol/sdk/types.js";
import { IndexBuilder } from "./utils/indexBuilder.js";
import { SkillIndex } from "./utils/skillIndex.js";
import { getConfig } from "./utils/config.js";
import { getRole } from "./tools/getRole.js";
import { listRoles } from "./tools/listRoles.js";
import { searchRoles } from "./tools/searchRoles.js";
import { getRoleDomains } from "./tools/getRoleDomains.js";
import { getSkill } from "./tools/getSkill.js";
import { listSkills } from "./tools/listSkills.js";

const TOOLS: Tool[] = [
  {
    name: "get_role",
    description: "Get full role content by role ID",
    inputSchema: {
      type: "object",
      properties: {
        role_id: { type: "string", description: "Unique role identifier" },
      },
      required: ["role_id"],
    },
  },
  {
    name: "list_roles",
    description: "List all roles with optional filtering",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Substring filter for id/name/description" },
        domain: { type: "string", description: "Filter by domain" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
      },
    },
  },
  {
    name: "search_roles",
    description: "Search roles by query substring",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_domains",
    description: "Get list of all unique domains",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_skill",
    description:
      "Get full superpowers skill content (SKILL.md) by skill ID. Subagents MUST call this to load any required skill before executing the task.",
    inputSchema: {
      type: "object",
      properties: {
        skill_id: {
          type: "string",
          description: "Skill identifier, e.g. 'systematic-debugging', 'test-driven-development'",
        },
      },
      required: ["skill_id"],
    },
  },
  {
    name: "list_skills",
    description: "List all available superpowers skills with id/name/description.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export async function startServer(): Promise<void> {
  const config = getConfig();
  const index = new IndexBuilder(config.rolesPath);
  index.build();

  const skills = new SkillIndex(config.skillsPath);
  skills.build();

  console.error(`Loaded ${index.count} roles from ${config.rolesPath}`);
  console.error(`Loaded ${skills.count} skills from ${config.skillsPath}`);

  const capabilities: ServerCapabilities = {
    tools: {},
    resources: {},
  };

  const server = new Server(
    {
      name: "superagents-mcp",
      version: "1.0.0",
    },
    { capabilities }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "get_role": {
        const role = getRole(index, args as { role_id: string });
        if (!role) {
          const content: TextContent[] = [
            { type: "text", text: JSON.stringify({ error: "Role not found" }) },
          ];
          return { content };
        }
        const content: TextContent[] = [
          { type: "text", text: JSON.stringify(role) },
        ];
        return { content };
      }

      case "list_roles": {
        const roles = listRoles(index, args as { filter?: string; domain?: string; tags?: string[] });
        const content: TextContent[] = [
          { type: "text", text: JSON.stringify({ roles, count: roles.length }) },
        ];
        return { content };
      }

      case "search_roles": {
        const roles = searchRoles(index, args as { query: string });
        const content: TextContent[] = [
          { type: "text", text: JSON.stringify({ roles, count: roles.length }) },
        ];
        return { content };
      }

      case "get_domains": {
        const domains = getRoleDomains(index);
        const content: TextContent[] = [
          { type: "text", text: JSON.stringify({ domains }) },
        ];
        return { content };
      }

      case "get_skill": {
        const skill = getSkill(skills, args as { skill_id: string });
        if (!skill) {
          const content: TextContent[] = [
            { type: "text", text: JSON.stringify({ error: "Skill not found" }) },
          ];
          return { content };
        }
        const content: TextContent[] = [
          { type: "text", text: JSON.stringify(skill) },
        ];
        return { content };
      }

      case "list_skills": {
        const list = listSkills(skills);
        const content: TextContent[] = [
          { type: "text", text: JSON.stringify({ skills: list, count: list.length }) },
        ];
        return { content };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const roles = index.listRoles();
    return {
      resources: roles.map((r) => ({
        uri: `roles://${r.id}`,
        name: r.name,
        mimeType: "text/markdown",
        description: r.description,
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === "roles://index") {
      const roles = index.listRoles();
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ roles, count: roles.length }),
          },
        ],
      };
    }

    if (uri.startsWith("roles://")) {
      const roleId = uri.slice("roles://".length);
      const role = index.getRole(roleId);
      if (!role) {
        throw new Error(`Role not found: ${roleId}`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: "text/markdown",
            text: role.content,
          },
        ],
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Superagents MCP server running on stdio");

  // Handle SIGHUP for reload
  process.on("SIGHUP", () => {
    console.error("Received SIGHUP, reloading roles and skills...");
    index.build();
    skills.build();
    console.error(`Reloaded ${index.count} roles, ${skills.count} skills`);
  });
}
