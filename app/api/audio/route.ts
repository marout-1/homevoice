/**
 * app/api/audio/route.ts
 * Proxies text to ElevenLabs TTS and streams back MP3 audio.
 * Called client-side after script generation completes.
 * maxDuration is 10s on Hobby but the browser fetch doesn't care —
 * the response starts streaming immediately and the browser buffers it.
 */

import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 10;

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No ElevenLabs API key configured." }, { status: 503 });
  }

  if (!text || text.length < 10) {
    return NextResponse.json({ error: "No text provided." }, { status: 400 });
  }

  // eleven_turbo_v2_5 — newest model, fastest + best quality
  // Default: "Charlie" — warm, natural podcast host voice
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "IKne3meq5aSn9XLyUdCD"; // Charlie

  const elevenRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!elevenRes.ok) {
    const err = await elevenRes.text();
    console.error("[audio] ElevenLabs error:", elevenRes.status, err);
    return NextResponse.json({ error: `ElevenLabs error ${elevenRes.status}: ${err}` }, { status: 502 });
  }

  const audioBuffer = await elevenRes.arrayBuffer();
  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.byteLength),
    },
  });
}
