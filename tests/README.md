# Trove Testing Guide

## Quick Start

```bash
# Run all tests (unit tests only, no server required)
npm run test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with UI
npm run test:ui
```

## Test Structure

```
tests/
├── unit/                    # Unit tests (no external dependencies)
│   └── extraction-schema.test.ts
├── integration/             # API integration tests (requires dev server)
│   └── extract-api.test.ts
├── fixtures/                # Test data
│   ├── test-urls.ts
│   └── mock-extractions.ts
├── utils/                   # Test utilities
│   └── test-helpers.ts
└── setup.ts                 # Global test setup
```

## Test Types

### Unit Tests (Fast, No Dependencies)

Unit tests validate business logic, schemas, and utilities without requiring external services.

**Run:** `npm run test tests/unit`

**Examples:**
- Schema validation (Zod)
- Type guards
- Utility functions
- Data transformations

**Current coverage:**
- ✅ ProductExtractionSchema validation (18 tests)

### Integration Tests (Requires Dev Server)

Integration tests verify API endpoints work correctly end-to-end.

**Requirements:**
1. Next.js dev server running: `npm run dev`
2. Environment variables set in `.env.local`

**Run:**
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run integration tests
npm run test tests/integration
```

**Current coverage:**
- ✅ `/api/extract` endpoint (error handling + live extraction)

## Running Integration Tests with Real APIs

To test actual extraction from URLs:

1. **Set up environment variables** in `.env.local`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_SUPABASE_URL=https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **Run tests** (in separate terminal):
   ```bash
   npm run test tests/integration
   ```

Tests will automatically detect API keys and run live extraction tests. Without keys, only error handling tests run.

## Test Fixtures

### Mock Extractions

Pre-defined extraction results for testing schema validation:
- `MOCK_WATCH_EXTRACTION` - Omega Speedmaster example
- `MOCK_WINE_EXTRACTION` - Opus One example
- `MOCK_BOOK_EXTRACTION` - Project Hail Mary example
- `MOCK_LOW_CONFIDENCE_EXTRACTION` - Below 0.7 threshold
- `MOCK_MINIMAL_EXTRACTION` - Only required fields

### Test URLs

Real product URLs for live extraction testing:
- Watches: Hodinkee, Chrono24
- Wine: Vivino
- Books: Amazon
- Sneakers: Nike
- Electronics: B&H Photo

## Testing Workflow

### Before Committing

Always run tests before committing:

```bash
npm run test        # Run all tests
npm run type-check  # TypeScript validation
npm run lint        # ESLint
```

### During Development

Use watch mode to test as you code:

```bash
npm run test:watch
```

This will re-run tests automatically when you save files.

### Testing New Features

1. **Write unit tests first** for schemas, utilities, business logic
2. **Write integration tests** for API endpoints
3. **Test locally** with real APIs to verify extraction quality
4. **Update fixtures** if adding new product types

## Example: Testing a New Feature

Let's say you're adding a new `item_type` (e.g., "camera"):

1. **Add mock extraction** to `fixtures/mock-extractions.ts`:
   ```typescript
   export const MOCK_CAMERA_EXTRACTION: ProductExtraction = {
     item_type: 'camera',
     title: 'Sony A7 III',
     // ... other fields
   }
   ```

2. **Add unit test** to `unit/extraction-schema.test.ts`:
   ```typescript
   it('should validate a camera extraction', () => {
     const result = ProductExtractionSchema.safeParse(MOCK_CAMERA_EXTRACTION)
     expect(result.success).toBe(true)
   })
   ```

3. **Add test URL** to `fixtures/test-urls.ts`:
   ```typescript
   camera_bhphoto: 'https://www.bhphotovideo.com/...'
   ```

4. **Test live extraction** with `npm run dev` + integration tests

## Troubleshooting

### "Connection refused" errors

Integration tests are trying to connect to localhost:3000 but dev server isn't running.

**Fix:** Start dev server in another terminal: `npm run dev`

### "API keys not set" warnings

This is expected if you haven't configured API keys. Unit tests will still pass.

**To fix:** Add keys to `.env.local` (see above)

### Tests timeout

Increase timeout for slow API calls:

```typescript
it('should extract data', async () => {
  // test code
}, 60000) // 60 second timeout
```

## CI/CD Integration

For GitHub Actions or other CI:

```yaml
# .github/workflows/test.yml
- name: Run unit tests
  run: npm run test tests/unit

# Integration tests require env vars + dev server
- name: Run integration tests
  run: |
    npm run dev &
    npm run test tests/integration
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Future Test Coverage

Planned test additions:

- [ ] `/api/items` CRUD operations
- [ ] `/api/collections` endpoints
- [ ] `/api/collections/[id]/items` many-to-many logic
- [ ] Database schema validation
- [ ] Error boundary testing
- [ ] Performance benchmarks

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Next.js Testing Guide](https://nextjs.org/docs/app/building-your-application/testing/vitest)
