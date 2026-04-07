import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

async function callApi(
  method: string,
  apiKey: string,
  params?: Record<string, unknown>,
  query?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`${SUPABASE_URL}/functions/v1/api-publications`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const opts: RequestInit = {
    method,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  };

  if (params && (method === "PATCH" || method === "POST")) {
    opts.body = JSON.stringify(params);
  }

  const res = await fetch(url.toString(), opts);
  return res.json();
}

// Create an MCP server factory per API key
function createMcpServer(apiKey: string) {
  const server = new McpServer({
    name: "kabbo",
    version: "1.0.0",
  });

  server.tool({
    name: "list_publications",
    description:
      "List all publications in the pipeline. Optionally filter by search query or stage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search publications by title (partial match)",
        },
        stage: {
          type: "string",
          description:
            "Filter by stage: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 100, max 500)",
        },
        offset: {
          type: "number",
          description: "Pagination offset",
        },
      },
    },
    handler: async (params: Record<string, unknown>) => {
      const q: Record<string, string> = {};
      if (params.query) q.q = String(params.query);
      if (params.stage) q.stage = String(params.stage);
      if (params.limit) q.limit = String(params.limit);
      if (params.offset) q.offset = String(params.offset);
      const result = await callApi("GET", apiKey, undefined, q);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  server.tool({
    name: "get_publication",
    description: "Get a single publication by its ID.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
      },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const result = await callApi("GET", apiKey, undefined, {
        id: String(params.id),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  server.tool({
    name: "create_publication",
    description:
      "Create a new publication in the pipeline. Title is required. Stage defaults to 'idea'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Publication title (required)" },
        authors: {
          type: "array",
          items: { type: "string" },
          description: "List of author names",
        },
        stage: {
          type: "string",
          description:
            "Pipeline stage: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published",
        },
        notes: { type: "string", description: "Notes about the publication" },
        output_type: {
          type: "string",
          description: "Output type: journal, book, chapter",
        },
        target_year: { type: "number", description: "Target completion year" },
        themes: {
          type: "array",
          items: { type: "string" },
          description: "Research themes/topics",
        },
        grants: {
          type: "array",
          items: { type: "string" },
          description: "Associated grants",
        },
        github_repo: { type: "string", description: "GitHub repository URL" },
        overleaf_url: { type: "string", description: "Overleaf project URL" },
      },
      required: ["title"],
    },
    handler: async (params: Record<string, unknown>) => {
      // Use the ingest endpoint for creation (it handles upsert)
      const url = `${SUPABASE_URL}/functions/v1/ingest-publication`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      });
      const result = await res.json();
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  server.tool({
    name: "update_publication",
    description:
      "Update an existing publication. Provide the ID and any fields to change.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID (required)" },
        title: { type: "string", description: "New title" },
        authors: {
          type: "array",
          items: { type: "string" },
          description: "Updated author list",
        },
        stage: {
          type: "string",
          description: "New pipeline stage",
        },
        notes: { type: "string", description: "Updated notes" },
        output_type: { type: "string", description: "Output type" },
        target_year: { type: "number", description: "Target year" },
        themes: {
          type: "array",
          items: { type: "string" },
          description: "Updated themes",
        },
        grants: {
          type: "array",
          items: { type: "string" },
          description: "Updated grants",
        },
        github_repo: { type: "string", description: "GitHub repo URL" },
        overleaf_url: { type: "string", description: "Overleaf URL" },
      },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const result = await callApi("PATCH", apiKey, params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  server.tool({
    name: "move_stage",
    description:
      "Move a publication to a different pipeline stage. Shorthand for update_publication with just stage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID" },
        stage: {
          type: "string",
          description:
            "Target stage: idea, draft, submitted, revise_resubmit, resubmitted, accepted, published",
        },
      },
      required: ["id", "stage"],
    },
    handler: async (params: Record<string, unknown>) => {
      const result = await callApi("PATCH", apiKey, {
        id: params.id,
        stage: params.stage,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  server.tool({
    name: "delete_publication",
    description:
      "Move a publication to the bin (soft delete). Can be restored later from the Kabbo UI.",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Publication UUID to delete" },
      },
      required: ["id"],
    },
    handler: async (params: Record<string, unknown>) => {
      const result = await callApi("DELETE", apiKey, undefined, {
        id: String(params.id),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  });

  return server;
}

const app = new Hono();

const transport = new StreamableHttpTransport();

// Extract API key from query params or headers
function getApiKey(req: Request): string | null {
  const url = new URL(req.url);
  return (
    url.searchParams.get("api_key") ||
    req.headers.get("x-api-key") ||
    null
  );
}

app.all("/*", async (c) => {
  const apiKey = getApiKey(c.req.raw);
  if (!apiKey) {
    return c.json(
      {
        error:
          "Missing API key. Pass as ?api_key=YOUR_KEY query param or x-api-key header.",
      },
      401
    );
  }

  const server = createMcpServer(apiKey);
  return await transport.handleRequest(c.req.raw, server);
});

Deno.serve(app.fetch);
