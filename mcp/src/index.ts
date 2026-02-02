#!/usr/bin/env node

// Load config first (validates env vars, loads .env)
import "./config.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Sprint 1: Core CRUD
import { registerListCollections } from "./tools/list-collections.js";
import { registerCreateCollection } from "./tools/create-collection.js";
import { registerAddItem } from "./tools/add-item.js";
import { registerAddItemFromData } from "./tools/add-item-from-data.js";
import { registerGetCollectionItems } from "./tools/get-collection-items.js";

// Sprint 2: Search + Photo
import { registerIdentifyPhoto } from "./tools/identify-photo.js";
import { registerSearchItems } from "./tools/search-items.js";
import { registerAddToCollection } from "./tools/add-to-collection.js";

const server = new McpServer({
  name: "trove",
  version: "0.1.0",
});

// Register all tools
registerListCollections(server);
registerCreateCollection(server);
registerAddItem(server);
registerAddItemFromData(server);
registerGetCollectionItems(server);
registerIdentifyPhoto(server);
registerSearchItems(server);
registerAddToCollection(server);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("Trove MCP server running on stdio");
