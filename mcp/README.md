# Trove MCP Server

Local MCP server that exposes Trove's item and collection management to Claude Desktop and Claude Code.

## Setup

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure Claude Code
Copy `.clauderc.example` to `.clauderc` in the project root and fill in your credentials:

```bash
cp .clauderc.example .clauderc
```

Edit `.clauderc` with your values:
- **SUPABASE_URL**: From Supabase dashboard → Project Settings → API → Project URL
- **SUPABASE_SERVICE_ROLE_KEY**: From Supabase dashboard → Project Settings → API → `service_role` key
- **TROVE_USER_ID**: Your UUID from `profiles` table (query: `SELECT id FROM profiles WHERE email = 'your-email'`)
- **ANTHROPIC_API_KEY**: Your Anthropic API key (for `identify_photo` tool)
- **JINA_API_KEY**: Optional - from https://jina.ai (for product URL search)

### 3. Restart Claude Code
The MCP server will auto-connect when you open this project.

## Available Tools

### Core CRUD
- `list_collections` - List user's collections with item counts
- `create_collection` - Create a new collection
- `add_item` - Add item by URL (triggers async extraction)
- `add_item_from_data` - Add item from structured data (no extraction needed)
- `get_collection_items` - List items in a collection with sorting

### Search & Photo
- `identify_photo` - Identify products in a photo using Claude Vision + Jina search
- `search_items` - Text search across user's items
- `add_to_collection` - Add existing item to a collection

## Example Workflows

### Batch add items from photo
```
Here's a photo of my wine shelf: /path/to/photo.jpg
Identify all the bottles and add them to my "Wine Collection"
```

### Add item by URL
```
Add this watch to my collection: https://example.com/product
```

### Search and organize
```
Search my items for "Nike" and show me what I have
```

## Development

### Type-check
```bash
npx tsc --noEmit
```

### Test server startup (smoke test)
```bash
SUPABASE_URL=https://test.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=test \
TROVE_USER_ID=test-uuid \
npx tsx src/index.ts
```

Should print: `Trove MCP server running on stdio`

## Architecture Notes

- **Transport**: stdio (JSON-RPC over stdin/stdout)
- **Auth**: Service role key + hardcoded user ID (local-only, not multi-user safe)
- **Future**: Migrate to HTTP transport + OAuth for multi-user hosted deployment
