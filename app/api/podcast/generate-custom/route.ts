/**
 * app/api/podcast/generate-custom/route.ts
 * Reads extracted text from storage, generates a podcast script via Claude,
 * then audio via ElevenLabs. Enforces free-tier first-use gate.
 *
 * POST { fullTextKey, userId, brandName, sourceLabel, sourceType }
 * Returns { script, podcastId } or { paywalled: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/app/lib/supabase/server";

export const maxDuration = 60;

const ANTHROPIC_MODEL = "claude-sonnet-4-6";

async function generateCustomScript(
  content: string,
  brandName: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const systemPrompt = `You are a professional real estate podcast narrator for ${brandName}.
You create engaging, conversational audio content from written real estate material.

CRITICAL rules for natural audio:
- Write ONLY what will be spoken aloud — no stage directions, labels, or section headers
- Use contractions everywhere (it's, we're, that's, you'll, here's, let's)
- Short punchy sentences mixed with longer ones for rhythm
- Start sentences with "And", "But", "So", "Now" — that's how people talk
- Use casual phrases: "here's the thing", "what's interesting is", "here's where it gets good"
- NO bullet points, NO lists, NO formal language, NO semicolons
- Commas and em-dashes for natural pauses
- Never say "furthermore", "moreover", "in conclusion", "it is worth noting"`;

  const userPrompt = `Based on the following real estate content, write a conversational podcast script
(400–600 words total) with these four parts flowing together naturally:

1. An engaging 2-sentence hook that makes the listener lean in
2. The main content — cover the key points from the source material conversationally
3. A practical takeaway for the listener (buyer, seller, or investor perspective)
4. A branded outro mentioning "${brandName}" and this natural disclaimer woven in:
   "This is for informational purposes only and is not financial or appraisal advice."

Write it as one continuous spoken piece with no section labels. Here is the content:

---
${content.slice(0, 8000)}
---

Write only the spoken script, nothing else.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text ?? "";
}

async function generateAudio(scriptText: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: scriptText,
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) return null;

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return audioBuffer.toString("base64");
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { fullTextKey, userId, brandName, sourceLabel, sourceType } =
      await req.json();

    if (!fullTextKey || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── Free-tier gate ────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, custom_podcast_count, podcasts_this_month")
      .eq("id", userId)
      .single();

    const isPro = profile?.plan === "pro";
    const customCount = profile?.custom_podcast_count ?? 0;

    if (!isPro && customCount >= 1) {
      return NextResponse.json({ paywalled: true });
    }

    // ── Read extracted text from storage ─────────────────────────────────────
    const { data: fileData, error: storageError } = await supabase.storage
      .from("homevoice-uploads")
      .download(fullTextKey);

    if (storageError || !fileData) {
      return NextResponse.json(
        { error: "Content expired. Please upload or paste your content again." },
        { status: 422 }
      );
    }

    const fullText = await fileData.text();

    // ── Generate script ───────────────────────────────────────────────────────
    const resolvedBrand = brandName?.trim() || "HomeVoice";
    const scriptText = await generateCustomScript(fullText, resolvedBrand);

    if (!scriptText) {
      return NextResponse.json(
        { error: "Script generation failed. Please try again." },
        { status: 500 }
      );
    }

    // ── Generate audio ────────────────────────────────────────────────────────
    const audioBase64 = await generateAudio(scriptText);

    // ── Save to database ──────────────────────────────────────────────────────
    const { data: newPodcast } = await supabase
      .from("podcasts")
      .insert({
        user_id: userId,
        address: sourceLabel || "Custom Content",
        city: null,
        state: null,
        zestimate: null,
        script_text: scriptText,
        audio_provider: audioBase64 ? "elevenlabs" : "none",
        brand_name: resolvedBrand,
        source_type: sourceType || "file",
        source_label: sourceLabel || null,
      })
      .select()
      .single();

    // ── Increment custom_podcast_count ────────────────────────────────────────
    await supabase
      .from("profiles")
      .update({
        custom_podcast_count: customCount + 1,
        podcasts_this_month: (profile?.podcasts_this_month ?? 0) + 1,
      })
      .eq("id", userId);

    return NextResponse.json({
      script: scriptText,
      podcastId: newPodcast?.id ?? null,
      audioBase64: audioBase64 ?? null,
      audioAvailable: !!audioBase64,
    });
  } catch (err) {
    console.error("[generate-custom] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
