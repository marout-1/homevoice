import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache — keyed by query string, expires after 5 minutes
const cache = new Map<string, { results: PlaceResult[]; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

interface PlaceResult {
  placeId: string;
  formatted: string;
  street: string;
  cityStateZip: string;
}

interface GooglePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Places API not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = `${query}|${lat ?? ""}|${lon ?? ""}`;

  // Serve from cache if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.results });
  }

  // Build Google Places Autocomplete request
  // - type=address for street-level results
  // - components=country:us to restrict to US
  // - location + radius for proximity bias (not restriction)
  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    types: "address",
    components: "country:us",
    language: "en",
  });

  // Add location bias if coordinates provided
  if (lat && lon) {
    params.set("location", `${lat},${lon}`);
    params.set("radius", "50000"); // 50km bias radius — still shows other results, just sorts near ones first
  }

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      return NextResponse.json({ results: [] }, { status: 502 });
    }

    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("[places] Google API error:", data.status, data.error_message);
      return NextResponse.json({ results: [] });
    }

    const predictions: GooglePrediction[] = data.predictions ?? [];
    const results: PlaceResult[] = predictions.map((p) => {
      const main = p.structured_formatting.main_text; // e.g. "1884 Fleming Woods Rd"
      const secondary = p.structured_formatting.secondary_text; // e.g. "Wysox Township, PA, USA"
      // Strip trailing ", USA"
      const cityStateZip = secondary.replace(/, USA$/, "").replace(/, United States$/, "");
      const formatted = `${main}, ${cityStateZip}`;
      return {
        placeId: p.place_id,
        formatted,
        street: main,
        cityStateZip,
      };
    });

    // Cache results
    cache.set(cacheKey, { results, ts: Date.now() });

    // Evict entries older than TTL to prevent unbounded growth
    for (const [key, val] of cache.entries()) {
      if (Date.now() - val.ts > CACHE_TTL_MS) cache.delete(key);
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[places] fetch error:", err);
    return NextResponse.json({ results: [] });
  }
}
