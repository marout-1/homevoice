/**
 * app/api/podcast/ingest-url/route.ts
 * Fetches a URL server-side, strips nav/ads via Readability, and returns
 * a preview excerpt + a storage key for generate-custom.
 *
 * POST { url: string }
 * Returns { previewExcerpt, previewExpanded, fullTextKey, wordCount, sourceLabel, pageTitle }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/app/lib/supabase/server";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export const maxDuration = 20;

const BOILERPLATE_SKIP = 600;
const PREVIEW_LENGTH   = 400;
const MAX_CHARS        = 50_000;
const FETCH_TIMEOUT_MS = 10_000;

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "No URL provided" }, { status: 400 });
    }

    if (!url.startsWith("https://")) {
      return NextResponse.json(
        { error: "Please use a secure https:// URL." },
        { status: 400 }
      );
    }

    // Fetch with timeout
    let html: string;
    let pageTitle = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; HomeVoiceBot/1.0; +https://homevoice.app)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json(
          {
            error:
              "We couldn't access that page. It may be behind a login or paywall.",
            fallback: true,
          },
          { status: 422 }
        );
      }

      html = await res.text();
    } catch (fetchErr: unknown) {
      const isTimeout =
        fetchErr instanceof Error && fetchErr.name === "AbortError";
      return NextResponse.json(
        {
          error: isTimeout
            ? "That page took too long to load."
            : "We couldn't access that page.",
          fallback: true,
        },
        { status: 422 }
      );
    }

    // Parse with Readability
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      return NextResponse.json(
        {
          error:
            "We couldn't extract content from that page. Try pasting the text directly.",
          fallback: true,
        },
        { status: 422 }
      );
    }

    pageTitle = article.title || new URL(url).hostname;

    let fullText = article.textContent
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_CHARS);

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    if (wordCount < 100) {
      return NextResponse.json(
        {
          error:
            "Not enough content on that page. Try pasting the text directly.",
          fallback: true,
        },
        { status: 422 }
      );
    }

    const previewStart = fullText.length > BOILERPLATE_SKIP + 200 ? BOILERPLATE_SKIP : 0;
    const previewExcerpt = fullText
      .slice(previewStart, previewStart + PREVIEW_LENGTH)
      .replace(/\n+/g, " ")
      .trim();

    const previewExpanded = fullText
      .slice(previewStart, previewStart + 1200)
      .replace(/\n+/g, " ")
      .trim();

    // Store full text
    const supabase = createServiceClient();
    const key = `extracts/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
    await supabase.storage
      .from("homevoice-uploads")
      .upload(key, Buffer.from(fullText, "utf-8"), {
        contentType: "text/plain",
        upsert: false,
      });

    const domain = new URL(url).hostname.replace(/^www\./, "");

    return NextResponse.json({
      previewExcerpt,
      previewExpanded,
      fullTextKey: key,
      wordCount,
      sourceLabel: domain,
      pageTitle,
      sourceType: "url",
    });
  } catch (err) {
    console.error("[ingest-url] error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
