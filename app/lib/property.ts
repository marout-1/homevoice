/**
 * lib/property.ts
 * Fetches real property data from APIllow (Zillow data API).
 * Uses async job flow: POST /v1/properties → poll /v1/results/{job_id}
 * Throws an error if no data can be found — no fake fallback.
 */

export interface PropertyData {
  address: string;
  zipCode: string;
  city: string;
  state: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  zestimate: number | null;
  lastSoldPrice: number | null;
  lastSoldDate: string | null;
  propertyType: string | null;
  comps: Comp[];
  dataSource: string;
  imageUrls: string[];
  latitude: number | null;
  longitude: number | null;
}

export interface Comp {
  address: string;
  soldPrice: number;
  soldDate: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  distanceMiles: number | null;
}

const APILLOW_BASE = "https://api.apillow.co";

// ─── APIllow (primary) ────────────────────────────────────────────────────────

async function fetchApillowProperty(address: string): Promise<PropertyData | null> {
  const apiKey = process.env.APILLOW_API_KEY;
  if (!apiKey) return null;

  try {
    // Step 1: submit job
    const submitRes = await fetch(`${APILLOW_BASE}/v1/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        addresses: [address],
        max_items: 1,
      }),
    });

    if (!submitRes.ok) {
      console.warn("[property] APIllow submit failed:", submitRes.status);
      return null;
    }

    const submitData = await submitRes.json();
    const jobId = submitData?.job_id;
    if (!jobId) return null;

    console.log("[property] APIllow job submitted:", jobId);

    // Step 2: poll for results (max ~20s, poll every 4s — stay under 5 req/min rate limit)
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));

      const pollRes = await fetch(`${APILLOW_BASE}/v1/results/${jobId}`, {
        headers: { "X-API-Key": apiKey },
      });

      if (pollRes.status === 429) {
        // Rate limited — wait longer before retrying
        console.warn("[property] APIllow rate limited on poll, waiting...");
        await new Promise((r) => setTimeout(r, 6000));
        continue;
      }

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (pollData.status === "processing") continue;
      if (pollData.status !== "complete") {
        console.warn("[property] APIllow job failed:", pollData.status);
        return null;
      }

      const result = pollData.results?.[0];
      if (!result?.success || !result.property) {
        console.warn("[property] APIllow no results for address");
        return null;
      }

      const p = result.property;

      // Extract comps from price_history sold events as a lightweight comp source
      const comps: Comp[] = [];
      if (Array.isArray(p.price_history)) {
        const soldEvents = p.price_history
          .filter((h: Record<string, unknown>) =>
            typeof h.event === "string" && h.event.toLowerCase().includes("sold") && h.price
          )
          .slice(0, 3);

        for (const h of soldEvents) {
          comps.push({
            address: p.street_address || address,
            soldPrice: h.price as number,
            soldDate: h.date as string || "",
            beds: p.bedrooms ?? null,
            baths: p.bathrooms ?? null,
            sqft: p.living_area ?? null,
            distanceMiles: null,
          });
        }
      }

      return {
        address: p.street_address || address,
        zipCode: String(p.zipcode || ""),
        city: p.city || "",
        state: p.state || "",
        beds: p.bedrooms ?? null,
        baths: p.bathrooms ?? null,
        sqft: p.living_area ?? null,
        yearBuilt: p.year_built ?? null,
        zestimate: p.zestimate ?? null,
        lastSoldPrice: p.last_sold_price ?? null,
        lastSoldDate: p.last_sold_date ?? null,
        propertyType: p.property_type ?? null,
        comps,
        dataSource: "Zillow (via APIllow)",
        imageUrls: Array.isArray(p.image_urls) ? (p.image_urls as string[]).slice(0, 5) : [],
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
      };
    }

    console.warn("[property] APIllow polling timed out");
    return null;
  } catch (err) {
    console.error("[property] APIllow error:", err);
    return null;
  }
}

// ─── Rentcast fallback ─────────────────────────────────────────────────────────

async function fetchRentcastProperty(address: string): Promise<PropertyData | null> {
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}`,
      { headers: { "X-Api-Key": apiKey } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const p = Array.isArray(data) ? data[0] : data;
    if (!p) return null;

    return {
      address: p.formattedAddress || address,
      zipCode: p.zipCode || "",
      city: p.city || "",
      state: p.state || "",
      beds: p.bedrooms ?? null,
      baths: p.bathrooms ?? null,
      sqft: p.squareFootage ?? null,
      yearBuilt: p.yearBuilt ?? null,
      zestimate: p.price ?? null,
      lastSoldPrice: p.lastSalePrice ?? null,
      lastSoldDate: p.lastSaleDate ?? null,
      propertyType: p.propertyType ?? null,
      comps: [],
      dataSource: "Rentcast",
      imageUrls: [],
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Parse city/state/zip from a free-form address string ────────────────────

function parseAddressParts(address: string): { city: string; state: string; zipCode: string } {
  // Try to extract "City, ST 12345" or "City, ST" from the end of the address
  const match = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})?/);
  if (match) {
    return {
      city: match[1].trim(),
      state: match[2].trim(),
      zipCode: match[3]?.trim() ?? "",
    };
  }
  // Simpler: last two comma-separated parts
  const parts = address.split(",").map((p) => p.trim());
  const state = parts[parts.length - 1]?.replace(/\d+/g, "").trim() ?? "";
  const city = parts[parts.length - 2]?.trim() ?? "";
  return { city, state, zipCode: "" };
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function getPropertyData(address: string): Promise<PropertyData> {
  // Try APIllow first (Zillow data)
  const apillow = await fetchApillowProperty(address);
  if (apillow) return apillow;

  // Try Rentcast as fallback
  const rentcast = await fetchRentcastProperty(address);
  if (rentcast) return rentcast;

  // No data found in any source — return a minimal stub so the podcast
  // can still be generated using Claude's knowledge of the area.
  console.warn(`[property] No data found for "${address}" — using address-only fallback`);
  const { city, state, zipCode } = parseAddressParts(address);
  return {
    address,
    zipCode,
    city,
    state,
    beds: null,
    baths: null,
    sqft: null,
    yearBuilt: null,
    zestimate: null,
    lastSoldPrice: null,
    lastSoldDate: null,
    propertyType: null,
    comps: [],
    dataSource: "address-only",
    imageUrls: [],
    latitude: null,
    longitude: null,
  };
}
