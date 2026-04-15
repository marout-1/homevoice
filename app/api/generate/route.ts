/**
 * app/api/generate/route.ts
 * Main orchestration endpoint — fast, stays well under Vercel's 60s limit.
 * POST { address, brandName, agentContext, podcastTone, podcastFormat }
 *
 * Pipeline:
 *   1. Fetch property data (Zillow via APIllow → Rentcast)
 *   2. Fetch market context (Serper news + ZipMarketData ZIP stats in parallel)
 *   3. Fetch mortgage rates (Lambda Finance → FRED)
 *   4. Generate podcast script via Claude Sonnet 4.5
 *   5. Return script + property data (audio fetched separately via /api/tts)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPropertyData } from "@/app/lib/property";
import { getMarketContext } from "@/app/lib/market";
import { generatePodcastScript } from "@/app/lib/script";
import { getMortgageRates, calcMonthlyPayment } from "@/app/lib/mortgage";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address: string = body.address?.trim();
    const brandName: string = body.brandName?.trim() || "HomeVoice";
    const agentContext: string = body.agentContext?.trim() || "";
    const podcastTone: string = body.podcastTone?.trim() || "friendly";
    const podcastFormat: string = body.podcastFormat?.trim() || "market-compass";

    if (!address || address.length < 5) {
      return NextResponse.json({ error: "Please provide a valid address." }, { status: 400 });
    }

    // ── Step 1: Property data ─────────────────────────────────────────────────
    console.log(`[generate] Fetching property data for: ${address}`);
    const property = await getPropertyData(address);

    // ── Step 2 & 3: Market context + mortgage rates in parallel ───────────────
    console.log(`[generate] Fetching market context + mortgage rates in parallel...`);
    const [market, mortgageRates] = await Promise.all([
      getMarketContext(property.city, property.state, property.zipCode, property.comps, property.zestimate),
      getMortgageRates(),
    ]);

    // Derive monthly payment for context
    const monthlyPayment = calcMonthlyPayment(property.zestimate, mortgageRates.rate30yr);

    // ── Step 4: Generate script ───────────────────────────────────────────────
    console.log("[generate] Generating podcast script...");
    const script = await generatePodcastScript(
      property,
      market,
      mortgageRates,
      brandName,
      agentContext,
      podcastTone,
      podcastFormat
    );

    // ── Step 5: Return ────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      property: {
        address: property.address,
        city: property.city,
        state: property.state,
        beds: property.beds,
        baths: property.baths,
        sqft: property.sqft,
        yearBuilt: property.yearBuilt,
        zestimate: property.zestimate,
        lastSoldPrice: property.lastSoldPrice,
        lastSoldDate: property.lastSoldDate,
        dataSource: property.dataSource,
        limitedData: property.dataSource === "address-only",
        imageUrls: property.imageUrls ?? [],
        latitude: property.latitude ?? null,
        longitude: property.longitude ?? null,
      },
      script: {
        fullText: script.fullText,
        sections: script.sections,
      },
      marketDataSource: market.dataSource,
      marketTemperature: market.stats?.marketTemperature ?? null,
      marketStats: market.stats ?? null,
      mortgageRates: {
        rate30yr: mortgageRates.rate30yr,
        rate15yr: mortgageRates.rate15yr,
        weekEnding: mortgageRates.weekEnding,
        source: mortgageRates.source,
        monthlyPayment,
      },
    });
  } catch (err: unknown) {
    console.error("[generate] Error:", err);
    const message = err instanceof Error ? `${err.message} | ${err.stack?.split('\n')[1] ?? ''}` : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
