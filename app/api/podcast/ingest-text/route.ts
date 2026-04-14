/**
 * app/api/podcast/ingest-text/route.ts
 * Accepts pasted plain text as fallback when file or URL ingestion fails.
 *
 * POST { text: string }
 * Returns { previewExcerpt, previewExpanded, fullTextKey, wordCount }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/app/lib/supabase/server";

export const maxDuration = 15;

const PREVIEW_LENGTH = 400;
const MAX_CHARS      = 50_000;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    let fullText = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_CHARS);

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    if (wordCount < 50) {
      return NextResponse.json(
        { error: "Please paste at least 50 words of content." },
        { status: 422 }
      );
    }

    const previewExcerpt = fullText
      .slice(0, PREVIEW_LENGTH)
      .replace(/\n+/g, " ")
      .trim();

    const previewExpanded = fullText
      .slice(0, 1200)
      .replace(/\n+/g, " ")
      .trim();

    const supabase = createServiceClient();
    const key = `extracts/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
    await supabase.storage
      .from("homevoice-uploads")
      .upload(key, Buffer.from(fullText, "utf-8"), {
        contentType: "text/plain",
        upsert: false,
      });

    return NextResponse.json({
      previewExcerpt,
      previewExpanded,
      fullTextKey: key,
      wordCount,
      sourceLabel: "Pasted content",
      sourceType: "text",
    });
  } catch (err) {
    console.error("[ingest-text] error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
