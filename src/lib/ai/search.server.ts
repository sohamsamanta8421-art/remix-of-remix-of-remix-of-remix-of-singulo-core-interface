export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

const decode = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Web search via DuckDuckGo's HTML endpoint. No API key required; runs
 * server-side only so the browser never issues cross-origin scrapes.
 */
export async function runWebSearch(query: string, limit: number): Promise<SearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; SinguloBot/1.0)",
      },
      body: new URLSearchParams({ q: query }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Search provider returned ${response.status}`);
    const html = await response.text();

    const results: SearchResult[] = [];
    const blocks = html.split('class="result');
    for (const block of blocks.slice(1)) {
      const linkMatch = block.match(/href="(https?:\/\/[^"]+)"[^>]*class="result__a"/);
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const url = linkMatch?.[1] ?? block.match(/uddg=([^&"]+)/)?.[1];
      if (!url || !titleMatch?.[1]) continue;
      results.push({
        title: decode(titleMatch[1]),
        snippet: snippetMatch?.[1] ? decode(snippetMatch[1]) : "",
        url: url.startsWith("http") ? url : decodeURIComponent(url),
      });
      if (results.length >= limit) break;
    }
    return results;
  } finally {
    clearTimeout(timeout);
  }
}