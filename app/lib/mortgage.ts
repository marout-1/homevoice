/**
 * lib/mortgage.ts
 * Fetches current mortgage rate data for affordability context in podcasts.
 * Primary: Lambda Finance (Freddie Mac PMMS — free)
 * Fallback: FRED API (Federal Reserve — completely free, no key needed)
 */

export interface MortgageRates {
  rate30yr: number | null;       // 30-year fixed rate (%)
  rate15yr: number | null;       // 15-year fixed rate (%)
  weekEnding: string | null;     // date of the rate reading
  source: string;
  // Derived affordability for a given price
  monthlyPayment?: number | null; // at 20% down, 30yr fixed
}

// ─── Calculate monthly P&I payment ────────────────────────────────────────────

export function calcMonthlyPayment(
  price: number | null,
  annualRate: number | null,
  downPct = 0.20,
  termYears = 30
): number | null {
  if (!price || !annualRate || annualRate <= 0) return null;
  const principal = price * (1 - downPct);
  const monthlyRate = annualRate / 100 / 12;
  const n = termYears * 12;
  const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) /
    (Math.pow(1 + monthlyRate, n) - 1);
  return Math.round(payment);
}

// ─── Lambda Finance (primary) ─────────────────────────────────────────────────

async function fetchLambdaRates(): Promise<MortgageRates | null> {
  const apiKey = process.env.LAMBDA_FINANCE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.lambdafin.com/v1/mortgage-rates", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn("[mortgage] Lambda Finance non-ok:", res.status);
      return null;
    }

    const data = await res.json();
    console.log("[mortgage] Lambda Finance success");

    // Handle common response shapes
    const rate30 = data.rate_30yr ?? data.thirtyYear ?? data["30yr"] ?? data.fixed_30 ?? null;
    const rate15 = data.rate_15yr ?? data.fifteenYear ?? data["15yr"] ?? data.fixed_15 ?? null;
    const weekEnding = data.week_ending ?? data.weekEnding ?? data.date ?? null;

    if (!rate30) return null;

    return {
      rate30yr: parseFloat(rate30),
      rate15yr: rate15 ? parseFloat(rate15) : null,
      weekEnding,
      source: "Lambda Finance (Freddie Mac PMMS)",
    };
  } catch (err) {
    console.warn("[mortgage] Lambda Finance error:", err);
    return null;
  }
}

// ─── FRED fallback (Federal Reserve — no key needed) ─────────────────────────

async function fetchFREDRates(): Promise<MortgageRates | null> {
  try {
    // MORTGAGE30US series — weekly Freddie Mac PMMS 30yr fixed
    const res = await fetch(
      "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US&vintage_date=&output_type=file",
      { headers: { "Accept": "text/csv" } }
    );

    if (!res.ok) return null;

    const csv = await res.text();
    const lines = csv.trim().split("\n").filter(l => !l.startsWith("DATE"));
    const lastLine = lines[lines.length - 1];
    if (!lastLine) return null;

    const [date, rateStr] = lastLine.split(",");
    const rate = parseFloat(rateStr);
    if (isNaN(rate)) return null;

    console.log("[mortgage] FRED fallback success — rate:", rate, "as of", date);

    return {
      rate30yr: rate,
      rate15yr: null,
      weekEnding: date?.trim() ?? null,
      source: "Federal Reserve (FRED)",
    };
  } catch (err) {
    console.warn("[mortgage] FRED error:", err);
    return null;
  }
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function getMortgageRates(): Promise<MortgageRates> {
  const lambda = await fetchLambdaRates();
  if (lambda) return lambda;

  const fred = await fetchFREDRates();
  if (fred) return fred;

  // Graceful fallback — use a reasonable estimate with clear labeling
  console.warn("[mortgage] All rate sources failed — using estimate");
  return {
    rate30yr: null,
    rate15yr: null,
    weekEnding: null,
    source: "unavailable",
  };
}
