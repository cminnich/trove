export interface ProductSearchResult {
  url: string;
  title: string;
  snippet: string;
  domain: string;
}

/**
 * Search for product URLs using Jina Search API.
 * Returns ranked candidate URLs for a given search query.
 */
export async function searchProductUrl(
  query: string
): Promise<ProductSearchResult[]> {
  const apiKey = process.env.JINA_API_KEY;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(
    `https://s.jina.ai/${encodeURIComponent(query)}`,
    { headers }
  );

  if (!response.ok) {
    console.error(
      "Jina Search failed:",
      response.status,
      response.statusText
    );
    return [];
  }

  const json = await response.json();

  // Jina Search returns { code, status, data: [{ title, url, description, ... }] }
  const results: any[] = json.data || [];

  return results
    .filter((r: any) => r.url && r.title)
    .slice(0, 5)
    .map((r: any) => {
      let domain = "";
      try {
        domain = new URL(r.url).hostname.replace("www.", "");
      } catch {
        // ignore invalid URLs
      }
      return {
        url: r.url,
        title: r.title,
        snippet: r.description || r.content || "",
        domain,
      };
    });
}
