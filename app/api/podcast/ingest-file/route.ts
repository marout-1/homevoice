/**
 * app/api/podcast/ingest-file/route.ts
 * Accepts a multipart file upload (PDF, DOCX, TXT), extracts text,
 * and returns a preview excerpt + a temporary storage key for generate-custom.
 *
 * POST (multipart/form-data)
 *   file — the uploaded file
 *
 * Returns { previewExcerpt, fullTextKey, wordCount, sourceLabel }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/app/lib/supabase/server";

export const maxDuration = 30;

// How many chars to skip at the start (covers page, headers, boilerplate)
const BOILERPLATE_SKIP = 600;
const PREVIEW_LENGTH   = 400;
const MAX_CHARS        = 50_000;

const SUPPORTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const fileType = SUPPORTED_TYPES[mimeType];

    if (!fileType) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file." },
        { status: 400 }
      );
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 10) {
      return NextResponse.json(
        { error: "File is over 10MB. Please try a shorter document." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let fullText = "";

    if (fileType === "pdf") {
      // pdf-parse is CJS — require it to avoid ESM/CJS mismatch
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      fullText = result.text;
    } else if (fileType === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      fullText = result.value;
    } else {
      // TXT / MD
      fullText = buffer.toString("utf-8");
    }

    // Normalise whitespace
    fullText = fullText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_CHARS);

    const wordCount = fullText.split(/\s+/).filter(Boolean).length;

    if (wordCount < 50) {
      return NextResponse.json(
        { error: "Not enough content found in this file. Try a longer document." },
        { status: 422 }
      );
    }

    // Build preview: skip boilerplate at the top unless doc is very short
    const previewStart = fullText.length > BOILERPLATE_SKIP + 200 ? BOILERPLATE_SKIP : 0;
    const previewExcerpt = fullText
      .slice(previewStart, previewStart + PREVIEW_LENGTH)
      .replace(/\n+/g, " ")
      .trim();

    const previewExpanded = fullText
      .slice(previewStart, previewStart + 1200)
      .replace(/\n+/g, " ")
      .trim();

    // Store full text in Supabase Storage (30-day expiry bucket)
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
      sourceLabel: file.name,
      sourceType: "file",
    });
  } catch (err) {
    console.error("[ingest-file] error:", err);
    return NextResponse.json(
      { error: "Failed to read file. Please try again." },
      { status: 500 }
    );
  }
}
