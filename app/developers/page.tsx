import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Developer API — Open Trove",
  description:
    "REST API for your Trove collections and items. Authenticate with an API key and connect any AI tool or script.",
};

const ENDPOINTS: { method: string; path: string; desc: string }[] = [
  { method: "GET", path: "/api/v1/collections", desc: "List your collections" },
  { method: "POST", path: "/api/v1/collections", desc: "Create a collection" },
  { method: "GET", path: "/api/v1/collections/{id}", desc: "Get a collection with item count" },
  { method: "GET", path: "/api/v1/collections/{id}/items", desc: "List items in a collection" },
  { method: "POST", path: "/api/v1/collections/{id}/items", desc: "Add an item by URL or item_id" },
  { method: "DELETE", path: "/api/v1/collections/{id}/items?item_id=", desc: "Remove an item from a collection" },
  { method: "GET", path: "/api/v1/collections/{id}/context", desc: "Public LLM-ready Markdown export (public collections)" },
  { method: "POST", path: "/api/v1/items", desc: "Create an item from a URL (async extraction)" },
  { method: "GET", path: "/api/v1/items/{id}", desc: "Get item details / poll extraction status" },
  { method: "GET", path: "/api/v1/items/search?q=", desc: "Search your items by title, brand, category" },
  { method: "GET", path: "/api/v1/openapi.json", desc: "Machine-readable OpenAPI 3.1 spec" },
];

const methodColor: Record<string, string> = {
  GET: "text-open-green",
  POST: "text-sky-400",
  DELETE: "text-red-400",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-void border border-slate-800 rounded-md shadow-hard mb-6">
      <div className="font-mono text-xs uppercase tracking-widest text-slate-500 border-b border-slate-800 px-4 py-2">
        {title}
      </div>
      <div className="p-4 text-slate-300 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-slate-deep border border-slate-800 rounded-md p-4 overflow-x-auto text-xs text-slate-300 font-mono">
      <code>{children}</code>
    </pre>
  );
}

export default function DevelopersPage() {
  return (
    <div className="min-h-screen bg-void px-4 py-10 md:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-open-green font-mono font-bold tracking-widest uppercase text-2xl mb-2">
          Developer API
        </h1>
        <p className="text-slate-400 text-sm mb-8 font-mono">
          Connect any AI tool or script to your Trove. Public REST API, v1.
        </p>

        <Section title="Authentication">
          <p className="mb-3">
            All <code className="text-open-green">/api/v1</code> endpoints (except the public
            collection context export) require an API key sent as a Bearer token:
          </p>
          <Code>{`Authorization: Bearer trove_sk_...`}</Code>
          <p className="mt-3">
            Create and revoke keys under{" "}
            <Link href="/settings" className="text-open-green hover:underline">
              Settings → Developer
            </Link>
            . A key is shown in full only once at creation — store it somewhere safe.
          </p>
        </Section>

        <Section title="Base URL">
          <Code>{`https://opentrove.com`}</Code>
        </Section>

        <Section title="Quick start">
          <p className="mb-3">List your collections:</p>
          <Code>{`curl https://opentrove.com/api/v1/collections \\
  -H "Authorization: Bearer trove_sk_your_key"`}</Code>
          <p className="mt-4 mb-3">Add an item from a URL (extraction runs asynchronously):</p>
          <Code>{`curl -X POST https://opentrove.com/api/v1/items \\
  -H "Authorization: Bearer trove_sk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/product"}'

# → 202 Accepted { "item": { "id": "...", "extraction_status": "pending" } }
# Poll GET /api/v1/items/{id} until extraction_status is "complete".`}</Code>
        </Section>

        <Section title="Endpoints">
          <div className="space-y-2 font-mono text-xs">
            {ENDPOINTS.map((e) => (
              <div key={`${e.method} ${e.path}`} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                <span className={`w-16 shrink-0 font-bold ${methodColor[e.method] ?? "text-slate-300"}`}>
                  {e.method}
                </span>
                <span className="text-slate-200 break-all">{e.path}</span>
                <span className="text-slate-500 sm:ml-auto sm:text-right">{e.desc}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Pagination">
          <p>
            List endpoints accept <code className="text-open-green">limit</code> (default 50, max
            100) and <code className="text-open-green">offset</code> (default 0) query parameters,
            echoed back in the response.
          </p>
        </Section>

        <Section title="OpenAPI spec">
          <p>
            The full machine-readable spec is served at{" "}
            <a
              href="/api/v1/openapi.json"
              className="text-open-green hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              /api/v1/openapi.json
            </a>
            . Import it into Postman, an OpenAPI viewer, or an AI tool that consumes tool specs.
          </p>
        </Section>
      </div>
    </div>
  );
}
