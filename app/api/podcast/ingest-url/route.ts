/**
 * app/api/podcast/ingest-url/route.ts
 * Fetches a URL server-side, strips nav/ads with node-html-parser (pure JS,
 * no native deps), and returns a preview excerpt + storage key for generate-custom.
 *
 * POST { url: string }
 * Returns { previewExcerpt, previewExpanded, fullTextKey, wordCount, sourceLabel, pageTitle }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/app/lib/supabase/server";
import { parse as parseHTML } from "node-html-parser";

export const maxDuration = 20;

const BOILERPLATE_SKIP = 300;
const PREVIEW_LENGTH   = 400;
const MAX_CHARS        = 50_000;
const FETCH_TIMEOUT_MS = 10_000;

function extractText(html: string, url: string): { text: string; title: string } {
  const root = parseHTML(html, { blockTextElements: { script: false, style: false } });

  // Grab title before stripping
  const title =
    root.querySelector("meta[property='og:title']")?.getAttribute("content") ||
    root.querySelector("title")?.text ||
    new URL(url).hostname;

  // Remove noise elements
  for (const tag of ["script", "style", "nav", "footer", "header", "aside",
                      "noscript", "form", "button", "iframe", "figure", "figcaption"]) {
    root.querySelectorAll(tag).forEach((el) => el.remove());
  }
  // Remove hidden elements (common ad containers)
  root.querySelectorAll("[aria-hidden='true']").forEach((el) => el.remove());

  // Prefer article/main content
  const contentEl =
    root.querySelector("article") ||
    root.querySelector("main") ||
    root.querySelector('[role="main"]') ||
    root.querySelector(".article-body") ||
    root.querySelector(".post-content") ||
    root.querySelector(".entry-content") ||
    root;

  const raw = contentEl.structuredText ?? contentEl.text ?? "";

  return { text: raw, title: title.trim() };
}

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

    // Parse with node-html-parser (pure JS — works in all serverless envs)
    const { text: rawText, title: pageTitle } = extractText(html, url);

    let fullText = rawText
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
    const { error: uploadError } = await supabase.storage
      .from("homevoice-uploads")
      .upload(key, Buffer.from(fullText, "utf-8"), {
        contentType: "text/plain",
        upsert: false,
      });

    if (uploadError) {
      console.error("[ingest-url] storage upload error:", uploadError);
      return NextResponse.json(
        { error: "Storage error. Please try again.", fallback: true },
        { status: 500 }
      );
    }

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
      { error: "Something went wrong. Please try again.", fallback: true },
      { status: 500 }
    );
  }
}
