/**
 * app/api/generate/route.ts
 * Main orchestration endpoint — fast, stays well under Vercel's 10s limit.
 * POST { address: string, brandName: string }
 *
 * Pipeline:
 *   1. Fetch property data (Zillow → demo)
 *   2. Fetch market context
 *   3. Generate podcast script via Claude Haiku
 *   4. Return script + property data (NO audio — audio is fetched separately via /api/tts)
 *
 * Audio is intentionally NOT generated here. The client calls /api/tts with the
 * script text after this returns, keeping both calls well under their timeouts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPropertyData } from "@/app/lib/property";
import { getMarketContext } from "@/app/lib/market";
import { generatePodcastScript } from "@/app/lib/script";

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

    // ── Step 2: Market context ────────────────────────────────────────────────
    console.log(`[generate] Fetching market context for: ${property.city}, ${property.state}`);
    const market = await getMarketContext(property.city, property.state, property.zipCode, property.comps, property.zestimate);

    // ── Step 3: Generate script ───────────────────────────────────────────────
    console.log("[generate] Generating podcast script...");
    const script = await generatePodcastScript(property, market, brandName, agentContext, podcastTone, podcastFormat);

    // ── Step 4: Return (audio generated separately via /api/tts) ─────────────
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
    });
  } catch (err: unknown) {
    console.error("[generate] Error:", err);
    const message = err instanceof Error ? `${err.message} | ${err.stack?.split('\n')[1] ?? ''}` : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
