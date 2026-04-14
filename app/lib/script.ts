/**
 * lib/script.ts
 * Generates podcast scripts via Claude Sonnet 4.5.
 * Supports agent personalization (tone, format, custom context),
 * richer market data (comps, price trends, market temperature),
 * multiple podcast formats, and a news pre-synthesis pass for richer Trends content.
 */

import type { PropertyData } from "./property";
import type { MarketContext } from "./market";
import type { MortgageRates } from "./mortgage";
import { calcMonthlyPayment } from "./mortgage";

export interface PodcastScript {
  fullText: string;
  sections: {
    hook: string;
    overview: string;
    comps: string;
    trends: string;
    outlook: string;
    outro: string;
  };
}

// ─── Tone profiles ────────────────────────────────────────────────────────────

const TONE_PROFILES: Record<string, { label: string; instruction: string }> = {
  friendly: {
    label: "Friendly Advisor",
    instruction: "Warm, approachable, like a trusted friend in real estate. Uses 'we' and 'you', approachable analogies, encouraging tone. Makes the listener feel informed and confident.",
  },
  expert: {
    label: "Market Expert",
    instruction: "Authoritative, data-driven, precise. Like a Bloomberg analyst but approachable. Leads with numbers and facts. Measured enthusiasm. Uses specific stats confidently.",
  },
  neighborhood: {
    label: "Neighborhood Insider",
    instruction: "Local storyteller. Paints a picture of the community, lifestyle, and what it's actually like to live there. Weaves in neighborhood character alongside the data.",
  },
};

// ─── Format structures ────────────────────────────────────────────────────────

const FORMAT_STRUCTURES: Record<string, { label: string; sectionInstructions: string }> = {
  "market-compass": {
    label: "Market Compass",
    sectionInstructions: `
HOOK: Open with a compelling market insight or surprising data point about this neighborhood — something that makes the listener lean in. Target 40-60 words.
OVERVIEW: Paint a clear picture of this specific property — what it is, what makes it interesting, what the numbers say. Target 80-100 words.
COMPS: Dig into 2-3 comparable recent sales nearby. Be specific — give actual prices, dates, how this property stacks up. Make it feel like insider knowledge. Target 100-120 words.
TRENDS: What's happening in this market RIGHT NOW? Draw from the synthesised market themes. Price direction, inventory, buyer demand. Ground it in real data. Target 100-120 words.
OUTLOOK: Where is this market heading? What does the data suggest for buyers, sellers, or investors watching this area? Be thoughtful, not overly bullish. Target 80-100 words.
OUTRO: Warm sign-off. Mention the brand. Include the disclaimer naturally. Target 40-60 words.`,
  },
  "buyers-brief": {
    label: "Buyer's Brief",
    sectionInstructions: `
HOOK: Speak directly to a buyer considering this home. What's the one thing they need to know right now? Target 40-60 words.
OVERVIEW: Walk through the property from a buyer's perspective — key features, value, what they're actually getting. Target 80-100 words.
COMPS: How does this compare to what else sold nearby? Is this priced right? Give real examples. Target 100-120 words.
TRENDS: Is now a good time to buy in this market? Draw from the synthesised market themes. Inventory, competition. Target 100-120 words.
OUTLOOK: Should they move fast or do they have time? What's the risk of waiting? Target 80-100 words.
OUTRO: Warm close with brand and disclaimer. Target 40-60 words.`,
  },
  "sellers-advantage": {
    label: "Seller's Advantage",
    sectionInstructions: `
HOOK: Open with something that makes a seller feel good about their timing or position. Target 40-60 words.
OVERVIEW: Frame the property as a seller would — what it offers, what buyers are looking for, why it has appeal. Target 80-100 words.
COMPS: What did neighbors sell for? Set the seller's expectations with real data. Target 100-120 words.
TRENDS: What's working in sellers' favor right now? Draw from the synthesised market themes. Target 100-120 words.
OUTLOOK: When and how should they list for best results? Strategic framing. Target 80-100 words.
OUTRO: Supportive close with brand and disclaimer. Target 40-60 words.`,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number | null): string {
  if (!n) return "unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatNumber(n: number | null): string {
  if (!n) return "unknown";
  return new Intl.NumberFormat("en-US").format(n);
}

function spokenCurrency(n: number | null): string {
  if (!n) return "unknown";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} million dollars`;
  if (n >= 100_000) {
    const rounded = Math.round(n / 1000) * 1000;
    return `${(rounded / 1000).toFixed(0)}K`;
  }
  return formatCurrency(n);
}

// ─── News pre-synthesis ───────────────────────────────────────────────────────
// Converts raw article snippets into 3 clear market themes before the main prompt.
// This dramatically improves the Trends section quality.

async function synthesiseMarketNews(
  rawSummary: string,
  city: string,
  state: string,
  apiKey: string
): Promise<string> {
  if (!rawSummary || rawSummary.length < 50) return rawSummary;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        system: "You are a real estate market analyst. Distill news snippets into exactly 3 concise market themes. Each theme is one sentence. Be specific and factual. No fluff.",
        messages: [{
          role: "user",
          content: `Distill these ${city}, ${state} real estate news snippets into exactly 3 key market themes (one sentence each):\n\n${rawSummary}\n\nFormat:\nTheme 1: [sentence]\nTheme 2: [sentence]\nTheme 3: [sentence]`,
        }],
      }),
    });

    if (!res.ok) return rawSummary;
    const data = await res.json();
    const themes = data.content?.[0]?.text ?? rawSummary;
    console.log("[script] News pre-synthesis complete:", themes.slice(0, 100));
    return themes;
  } catch {
    return rawSummary;
  }
}

// ─── Build rich context block for Claude ─────────────────────────────────────

function buildContextBlock(
  property: PropertyData,
  market: MarketContext,
  synthesisedNews: string,
  mortgageRates: MortgageRates | null,
  brandName: string,
  agentContext: string
) {
  const recentSalesBlock = market.recentSales && market.recentSales.length > 0
    ? market.recentSales.map(s => ({
        address: s.address,
        soldPrice: formatCurrency(s.soldPrice),
        soldDate: s.soldDate,
        beds: s.beds,
        baths: s.baths,
        sqft: s.sqft ? formatNumber(s.sqft) : null,
        pricePerSqft: s.pricePerSqft ? `$${s.pricePerSqft}/sqft` : null,
      }))
    : property.comps.slice(0, 3).map(c => ({
        address: c.address,
        soldPrice: formatCurrency(c.soldPrice),
        soldDate: c.soldDate,
        beds: c.beds,
        baths: c.baths,
        sqft: c.sqft ? formatNumber(c.sqft) : null,
        pricePerSqft: null,
      }));

  return {
    property: {
      address: property.address,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft ? formatNumber(property.sqft) : null,
      yearBuilt: property.yearBuilt,
      propertyType: property.propertyType,
      estimatedValue: spokenCurrency(property.zestimate),
      lastSoldPrice: spokenCurrency(property.lastSoldPrice),
      lastSoldDate: property.lastSoldDate,
    },
    marketStats: {
      temperature: market.stats?.marketTemperature ?? "unknown",
      inventory: market.stats?.inventoryLabel ?? "unknown",
      priceChangePercent: market.stats?.priceChangePercent != null
        ? `${market.stats.priceChangePercent > 0 ? "+" : ""}${market.stats.priceChangePercent}%`
        : null,
      medianSalePrice: market.stats?.medianSalePrice
        ? spokenCurrency(market.stats.medianSalePrice)
        : null,
      medianDaysOnMarket: market.stats?.medianDaysOnMarket ?? null,
      activeListings: market.stats?.activeListings ?? null,
      inventoryMonths: market.stats?.inventoryMonths ?? null,
      listToSaleRatio: market.stats?.listToSaleRatio
        ? `${(market.stats.listToSaleRatio * 100).toFixed(1)}%`
        : null,
    },
    mortgageContext: mortgageRates?.rate30yr ? {
      rate30yr: `${mortgageRates.rate30yr}%`,
      rate15yr: mortgageRates.rate15yr ? `${mortgageRates.rate15yr}%` : null,
      weekEnding: mortgageRates.weekEnding,
      estimatedMonthlyPayment: calcMonthlyPayment(property.zestimate, mortgageRates.rate30yr)
        ? `$${calcMonthlyPayment(property.zestimate, mortgageRates.rate30yr)?.toLocaleString()}/mo (20% down, 30yr fixed)`
        : null,
    } : null,
    recentComparableSales: recentSalesBlock,
    marketThemes: synthesisedNews,
    brandName,
    agentPersonalContext: agentContext || null,
  };
}

// ─── Main generation function ─────────────────────────────────────────────────

export async function generatePodcastScript(
  property: PropertyData,
  market: MarketContext,
  mortgageRates: MortgageRates | null,
  brandName: string,
  agentContext = "",
  tone = "friendly",
  format = "market-compass"
): Promise<PodcastScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("[script] No ANTHROPIC_API_KEY — returning demo script");
    return buildDemoScript(property, brandName);
  }

  const toneProfile = TONE_PROFILES[tone] ?? TONE_PROFILES.friendly;
  const formatStructure = FORMAT_STRUCTURES[format] ?? FORMAT_STRUCTURES["market-compass"];

  // Pre-synthesise news into 3 market themes for a richer Trends section
  const synthesisedNews = await synthesiseMarketNews(
    market.summary,
    property.city ?? "",
    property.state ?? "",
    apiKey
  );

  const contextBlock = buildContextBlock(property, market, synthesisedNews, mortgageRates, brandName, agentContext);

  const systemPrompt = `You are a real estate podcast host generating a spoken-word audio script. Style: ${toneProfile.instruction}

CRITICAL rules for natural audio:
- Write ONLY what will be spoken aloud — no stage directions, no labels in the text
- Use contractions everywhere (it's, we're, that's, you'll, here's, let's, they've)
- Short punchy sentences. Then longer ones for rhythm. Mix them.
- Start sentences with "And", "But", "So", "Now" — that's how people talk
- Use casual phrases: "here's the thing", "what's interesting is", "here's where it gets good"
- Speak numbers as words: "just under four hundred thousand" not "$398,500"
- NO bullet points, NO lists, NO formal language, NO semicolons
- Commas and em-dashes for natural pauses
- Never say "furthermore", "moreover", "in conclusion", "it is worth noting", "it should be noted"
- Respect the target word counts per section — don't under-write
- If mortgageContext is provided, use it in the OUTLOOK or TRENDS section to ground affordability ("at today's rate of X%, monthly payments on this home run about $Y")
- If medianDaysOnMarket is provided, use it in TRENDS ("homes here are selling in about X days on average")
- If listToSaleRatio is provided and above 99%, mention it signals a competitive market
${agentContext ? `\nAgent personal context to weave in naturally: "${agentContext}"` : ""}`;

  const userPrompt = `Property and market data:

${JSON.stringify(contextBlock, null, 2)}

Write a ${formatStructure.label} podcast script. Use exactly these six labeled sections (label in ALL CAPS on its own line, followed by colon, then the spoken content on the next line):

${formatStructure.sectionInstructions}

Cite specific numbers from the data. Make the COMPS section feel like genuine insider knowledge — mention actual prices and dates. Draw from the marketThemes for the TRENDS section. The OUTRO must include "This is for informational purposes only and is not financial or appraisal advice" woven in naturally, then sign off warmly with "${brandName}".`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[script] Anthropic API error:", response.status, errText);
      return buildDemoScript(property, brandName);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text ?? "";
    const sections = parseSections(rawText);

    return {
      fullText: Object.values(sections).join("\n\n"),
      sections,
    };
  } catch (err) {
    console.error("[script] fetch error:", err);
    return buildDemoScript(property, brandName);
  }
}

// ─── Demo script ──────────────────────────────────────────────────────────────

function buildDemoScript(property: PropertyData, brandName: string): PodcastScript {
  const addr = property.address || "this property";
  const city = property.city || "the area";
  const est = spokenCurrency(property.zestimate);

  const sections = {
    hook: `Here's something worth knowing about the ${city} market right now — homes like the one at ${addr} are telling a really interesting story about where values are headed.`,
    overview: `This is a ${property.beds ?? "?"}-bedroom, ${property.baths ?? "?"}-bathroom home sitting at about ${property.sqft ? formatNumber(property.sqft) : "?"} square feet. Built in ${property.yearBuilt ?? "the past"}, it's currently valued at around ${est}. It last sold for ${spokenCurrency(property.lastSoldPrice)}, which gives us a solid baseline for comparison.`,
    comps: `Looking at what's sold nearby, the picture is pretty consistent. Similar homes in this neighborhood have been trading in a tight range, which tells you demand is steady. Buyers are active, and well-priced properties are not sitting long.`,
    trends: `The ${city} market continues to show resilience. Inventory is lean, which keeps upward pressure on prices. Days on market are low for homes that show well and are priced right — overpriced listings are the ones stacking up.`,
    outlook: `For ${addr}, the fundamentals look solid. Strong location, consistent comps, and a market that's still moving — that's a combination worth paying attention to whether you're buying, selling, or just watching.`,
    outro: `That's your HomeVoice market brief. Just a reminder — this is for informational purposes only and is not financial or appraisal advice. Thanks for listening, and we'll see you next time on ${brandName}.`,
  };

  return { fullText: Object.values(sections).join("\n\n"), sections };
}

// ─── Section parser ───────────────────────────────────────────────────────────

function parseSections(raw: string): PodcastScript["sections"] {
  const sectionNames = ["HOOK", "OVERVIEW", "COMPS", "TRENDS", "OUTLOOK", "OUTRO"] as const;
  const result: Record<string, string> = {};

  for (let i = 0; i < sectionNames.length; i++) {
    const name = sectionNames[i];
    const next = sectionNames[i + 1];
    const startPattern = new RegExp(`${name}:\\s*`, "i");
    const startMatch = raw.search(startPattern);

    if (startMatch === -1) {
      result[name.toLowerCase()] = "";
      continue;
    }

    const afterLabel = startMatch + raw.slice(startMatch).search(/\n/) + 1;
    let contentEnd: number;

    if (next) {
      const endPattern = new RegExp(`${next}:`, "i");
      const endMatch = raw.slice(afterLabel).search(endPattern);
      contentEnd = endMatch === -1 ? raw.length : afterLabel + endMatch;
    } else {
      contentEnd = raw.length;
    }

    result[name.toLowerCase()] = raw.slice(afterLabel, contentEnd).trim();
  }

  return {
    hook: result["hook"] || "",
    overview: result["overview"] || "",
    comps: result["comps"] || "",
    trends: result["trends"] || "",
    outlook: result["outlook"] || "",
    outro: result["outro"] || "",
  };
}
