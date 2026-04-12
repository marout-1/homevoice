/**
 * lib/market.ts
 * Fetches local real estate market news and trends for a zip code.
 * Uses Serper.dev (Google Search API) to find recent articles.
 * Falls back to placeholder context if the key is missing.
 */

export interface MarketContext {
  summary: string;       // 2–3 sentence summary for the podcast script
  articles: Article[];   // raw articles for transparency
  dataSource: string;
  // Enriched market stats (populated from property comps + derived data)
  stats?: {
    medianDaysOnMarket?: number;
    priceChangePercent?: number;    // vs last year
    medianSalePrice?: number;
    inventoryLabel?: string;        // "low" | "balanced" | "high"
    marketTemperature?: string;     // "hot" | "warm" | "cool" | "cold"
  };
  recentSales?: RecentSale[];
}

export interface RecentSale {
  address: string;
  soldPrice: number;
  soldDate: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  pricePerSqft: number | null;
}

interface Article {
  title: string;
  snippet: string;
  source: string;
  date: string | null;
}

// ─── Serper (Google Search) ────────────────────────────────────────────────────

async function fetchSerperNews(city: string, state: string, zipCode: string): Promise<MarketContext | null> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  const query = `real estate market ${city} ${state} ${zipCode} 2024 2025 housing prices trends`;

  try {
    const res = await fetch("https://google.serper.dev/news", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 5, tbs: "qdr:m6" }), // last 6 months
    });

    if (!res.ok) return null;
    const data = await res.json();

    const articles: Article[] = (data.news || []).slice(0, 5).map((a: Record<string, unknown>) => ({
      title: (a.title as string) || "",
      snippet: (a.snippet as string) || "",
      source: (a.source as string) || "",
      date: (a.date as string) || null,
    }));

    // Combine snippets for a summary that Claude can later polish
    const rawSummary = articles
      .map((a) => `${a.title}: ${a.snippet}`)
      .join(" | ");

    return {
      summary: rawSummary,
      articles,
      dataSource: "Serper (Google News)",
    };
  } catch {
    return null;
  }
}

// ─── Tavily fallback ───────────────────────────────────────────────────────────

async function fetchTavilyNews(city: string, state: string): Promise<MarketContext | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: `real estate housing market ${city} ${state} 2025 trends`,
        search_depth: "basic",
        max_results: 5,
        topic: "news",
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    const articles: Article[] = (data.results || []).slice(0, 5).map((r: Record<string, unknown>) => ({
      title: (r.title as string) || "",
      snippet: (r.content as string)?.slice(0, 200) || "",
      source: (r.url as string) || "",
      date: null,
    }));

    const rawSummary = articles.map((a) => `${a.title}: ${a.snippet}`).join(" | ");

    return {
      summary: rawSummary,
      articles,
      dataSource: "Tavily",
    };
  } catch {
    return null;
  }
}

// ─── Demo stub ─────────────────────────────────────────────────────────────────

function buildDemoMarket(city: string, state: string): MarketContext {
  return {
    summary: `The ${city}, ${state} housing market has seen moderate activity in recent months. ` +
      `Inventory remains constrained, keeping upward pressure on prices despite higher mortgage rates. ` +
      `The median days on market is approximately 28 days, slightly down from this time last year. ` +
      `New construction has picked up in surrounding suburbs, offering buyers more options outside the urban core.`,
    articles: [
      {
        title: `${city} Home Prices Hold Steady Amid Rate Uncertainty`,
        snippet: "Local real estate agents report that demand remains firm for move-in-ready homes in desirable zip codes.",
        source: "Demo News",
        date: "2025-01-15",
      },
    ],
    dataSource: "Demo data (add SERPER_API_KEY for live news)",
  };
}

// ─── Enrich market context with comp-derived stats ───────────────────────────

function enrichWithComps(
  market: MarketContext,
  comps: Array<{ address: string; soldPrice: number; soldDate: string; beds: number | null; baths: number | null; sqft: number | null }>,
  zestimate: number | null
): MarketContext {
  if (!comps || comps.length === 0) return market;

  const recentSales: RecentSale[] = comps
    .filter(c => c.soldPrice > 0)
    .map(c => ({
      address: c.address,
      soldPrice: c.soldPrice,
      soldDate: c.soldDate,
      beds: c.beds,
      baths: c.baths,
      sqft: c.sqft,
      pricePerSqft: c.sqft && c.sqft > 0 ? Math.round(c.soldPrice / c.sqft) : null,
    }));

  // Derive stats from comps
  const prices = recentSales.map(s => s.soldPrice).filter(p => p > 0);
  const medianSalePrice = prices.length > 0
    ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)]
    : null;

  // Rough price change: compare median comp to zestimate
  let priceChangePercent: number | undefined;
  if (medianSalePrice && zestimate && medianSalePrice > 0) {
    priceChangePercent = Math.round(((zestimate - medianSalePrice) / medianSalePrice) * 100);
  }

  // Market temperature from price trend
  let marketTemperature = "warm";
  if (priceChangePercent !== undefined) {
    if (priceChangePercent > 8) marketTemperature = "hot";
    else if (priceChangePercent > 3) marketTemperature = "warm";
    else if (priceChangePercent > -2) marketTemperature = "cool";
    else marketTemperature = "cold";
  }

  return {
    ...market,
    recentSales,
    stats: {
      medianSalePrice: medianSalePrice ?? undefined,
      priceChangePercent,
      marketTemperature,
      inventoryLabel: marketTemperature === "hot" ? "low" : marketTemperature === "cold" ? "high" : "balanced",
    },
  };
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function getMarketContext(
  city: string,
  state: string,
  zipCode: string,
  comps?: Array<{ address: string; soldPrice: number; soldDate: string; beds: number | null; baths: number | null; sqft: number | null }>,
  zestimate?: number | null
): Promise<MarketContext> {
  const serper = await fetchSerperNews(city, state, zipCode);
  const base = serper ?? await fetchTavilyNews(city, state) ?? buildDemoMarket(city, state);
  if (!serper) console.warn("No market news API keys found — using demo market context");
  return enrichWithComps(base, comps ?? [], zestimate ?? null);
}
