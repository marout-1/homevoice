/**
 * app/api/tts/route.ts
 * Text-to-speech endpoint — called by the client AFTER /api/generate succeeds.
 *
 * POST { text: string }
 * Returns { available: true, base64: string, provider: string }
 *      or { available: false, provider: "none" }
 *
 * Priority: ElevenLabs → OpenAI TTS HD → Kokoro-82M → none
 * Client falls back to browser speechSynthesis when available = false.
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Truncate at the last sentence boundary before maxChars
function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const truncated = text.slice(0, maxChars);
  // Find last sentence-ending punctuation
  const lastBreak = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! "),
    truncated.lastIndexOf(".\n"),
  );
  return lastBreak > maxChars * 0.5
    ? truncated.slice(0, lastBreak + 1).trim()
    : truncated.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText: string = body.text?.trim();

    if (!rawText || rawText.length < 10) {
      return NextResponse.json({ available: false, provider: "none" });
    }

    // ── ElevenLabs (primary — best voice quality) ─────────────────────────────
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (elKey) {
      try {
        console.log("[tts] Trying ElevenLabs...");
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Rachel
        const text = truncateAtSentence(rawText, 5000);
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.65,
              similarity_boost: 0.80,
              style: 0.20,
              use_speaker_boost: true,
            },
          }),
        });

        if (res.ok) {
          const buf = await res.arrayBuffer();
          console.log(`[tts] ElevenLabs success — ${buf.byteLength} bytes`);
          return NextResponse.json({
            available: true,
            base64: Buffer.from(buf).toString("base64"),
            provider: "ElevenLabs",
          });
        } else {
          const err = await res.text().catch(() => "");
          console.warn("[tts] ElevenLabs non-ok:", res.status, err);
        }
      } catch (err) {
        console.warn("[tts] ElevenLabs error:", err);
      }
    }

    // ── OpenAI TTS HD fallback ────────────────────────────────────────────────
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        console.log("[tts] Trying OpenAI TTS HD...");
        const text = truncateAtSentence(rawText, 4096);
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1-hd",
            input: text,
            voice: "nova",
            response_format: "mp3",
            speed: 0.95,
          }),
        });

        if (res.ok) {
          const buf = await res.arrayBuffer();
          console.log(`[tts] OpenAI TTS HD success — ${buf.byteLength} bytes`);
          return NextResponse.json({
            available: true,
            base64: Buffer.from(buf).toString("base64"),
            provider: "OpenAI TTS",
          });
        } else {
          const err = await res.text().catch(() => "");
          console.warn("[tts] OpenAI TTS HD non-ok:", res.status, err);
        }
      } catch (err) {
        console.warn("[tts] OpenAI TTS error:", err);
      }
    }

    // ── Kokoro-82M via Together AI (second fallback) ──────────────────────────
    const togetherKey = process.env.TOGETHER_API_KEY;
    if (togetherKey) {
      try {
        console.log("[tts] Trying Kokoro-82M via Together AI...");
        const text = truncateAtSentence(rawText, 4096);
        const res = await fetch("https://api.together.ai/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${togetherKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "kokoro-82m",
            input: text,
            voice: "af_heart",
            response_format: "mp3",
            speed: 1.0,
          }),
        });

        if (res.ok) {
          const buf = await res.arrayBuffer();
          console.log(`[tts] Kokoro-82M success — ${buf.byteLength} bytes`);
          return NextResponse.json({
            available: true,
            base64: Buffer.from(buf).toString("base64"),
            provider: "Kokoro-82M",
          });
        } else {
          const err = await res.text().catch(() => "");
          console.warn("[tts] Kokoro-82M non-ok:", res.status, err);
        }
      } catch (err) {
        console.warn("[tts] Kokoro-82M error:", err);
      }
    }

    console.log("[tts] No TTS keys configured — client will use browser TTS");
    return NextResponse.json({ available: false, provider: "none" });

  } catch (err: unknown) {
    console.error("[tts] Unexpected error:", err);
    return NextResponse.json({ available: false, provider: "none" });
  }
}
