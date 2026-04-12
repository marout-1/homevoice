/**
 * lib/audio.ts
 * Converts a podcast script to MP3 audio using ElevenLabs TTS.
 * Falls back to OpenAI TTS if ElevenLabs key is not set.
 * Returns a Buffer containing the MP3 data.
 */

// ─── ElevenLabs ───────────────────────────────────────────────────────────────

async function generateWithElevenLabs(text: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  // "Rachel" voice — warm, professional, American English
  // You can swap this voice ID in your .env as ELEVENLABS_VOICE_ID
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("ElevenLabs error:", errorText);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("ElevenLabs fetch failed:", err);
    return null;
  }
}

// ─── OpenAI TTS fallback ───────────────────────────────────────────────────────

async function generateWithOpenAI(text: string): Promise<Buffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: text,
        voice: "alloy", // warm, neutral voice
        response_format: "mp3",
        speed: 0.95, // slightly slower for clarity
      }),
    });

    if (!res.ok) {
      console.error("OpenAI TTS error:", await res.text());
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("OpenAI TTS failed:", err);
    return null;
  }
}

// ─── Public entry point ────────────────────────────────────────────────────────

export async function generateAudio(scriptText: string): Promise<{
  audioBuffer: Buffer | null;
  audioProvider: string;
}> {
  // Try ElevenLabs first (better voice quality)
  const elevenLabsBuffer = await generateWithElevenLabs(scriptText);
  if (elevenLabsBuffer) {
    return { audioBuffer: elevenLabsBuffer, audioProvider: "ElevenLabs" };
  }

  // Fall back to OpenAI TTS
  const openAIBuffer = await generateWithOpenAI(scriptText);
  if (openAIBuffer) {
    return { audioBuffer: openAIBuffer, audioProvider: "OpenAI TTS" };
  }

  // No TTS keys — return null so the UI shows script-only mode
  console.warn("No TTS API keys found — audio generation skipped");
  return { audioBuffer: null, audioProvider: "none" };
}
