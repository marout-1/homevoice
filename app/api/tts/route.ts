/**
 * app/api/tts/route.ts
 * Dedicated text-to-speech endpoint — called by the client AFTER /api/generate succeeds.
 * Keeping TTS separate avoids blowing the 10s timeout on the generate route.
 *
 * POST { text: string }
 * Returns { available: true, base64: string, provider: string }
 *      or { available: false, provider: "none" }
 *
 * Priority: Kokoro-82M via Together AI → OpenAI TTS (tts-1) → ElevenLabs turbo → none
 * Kokoro-82M: 82M params, MOS 4.2, Apache 2.0, OpenAI-compatible API via Together AI.
 * The client falls back to browser speechSynthesis when available = false.
 */

import { NextRequest, NextResponse } from "next/server";

// 60s is the max on Vercel Hobby for non-default routes
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text?.trim();

    if (!text || text.length < 10) {
      return NextResponse.json({ available: false, provider: "none" });
    }

    // ── Kokoro-82M via Together AI (preferred) ────────────────────────────────
    const togetherKey = process.env.TOGETHER_API_KEY;
    if (togetherKey) {
      try {
        console.log("[tts] Trying Kokoro-82M via Together AI...");
        const res = await fetch("https://api.together.ai/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${togetherKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "kokoro-82m",
            input: text.slice(0, 4096),
            voice: "af_heart",   // most natural-sounding Kokoro voice — warm, conversational American female
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

    // ── OpenAI TTS fallback ───────────────────────────────────────────────────
    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      try {
        console.log("[tts] Trying OpenAI TTS...");
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "tts-1",
            input: text.slice(0, 4096), // OpenAI limit
            voice: "nova",              // warm, professional female voice
            response_format: "mp3",
            speed: 0.95,
          }),
        });

        if (res.ok) {
          const buf = await res.arrayBuffer();
          console.log(`[tts] OpenAI TTS success — ${buf.byteLength} bytes`);
          return NextResponse.json({
            available: true,
            base64: Buffer.from(buf).toString("base64"),
            provider: "OpenAI TTS",
          });
        } else {
          const err = await res.text().catch(() => "");
          console.warn("[tts] OpenAI TTS non-ok:", res.status, err);
        }
      } catch (err) {
        console.warn("[tts] OpenAI TTS error:", err);
      }
    }

    // ── ElevenLabs fallback ────────────────────────────────────────────────────
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (elKey) {
      try {
        console.log("[tts] Trying ElevenLabs...");
        const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: text.slice(0, 3000),
            model_id: "eleven_turbo_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
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

    // ── No keys configured ────────────────────────────────────────────────────
    console.log("[tts] No TTS keys configured — client will use browser TTS");
    return NextResponse.json({ available: false, provider: "none" });

  } catch (err: unknown) {
    console.error("[tts] Unexpected error:", err);
    return NextResponse.json({ available: false, provider: "none" });
  }
}
