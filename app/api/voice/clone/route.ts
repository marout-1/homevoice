/**
 * app/api/voice/clone/route.ts
 * Sends an audio recording to ElevenLabs Instant Voice Cloning,
 * saves the resulting voice_id to the user's profile, and returns it.
 *
 * POST (multipart/form-data)
 *   audio — the recorded audio blob (webm/mp4/wav/mp3)
 *   name  — optional label for the voice (defaults to "My Voice")
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/app/lib/supabase/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ElevenLabs not configured." }, { status: 503 });
    }

    const formData = await req.formData();
    const audio = formData.get("audio");
    const name = (formData.get("name") as string) || "My HomeVoice";

    if (!audio || typeof audio === "string") {
      return NextResponse.json({ error: "No audio provided." }, { status: 400 });
    }

    const sizeMB = (audio as File).size / (1024 * 1024);
    if (sizeMB > 10) {
      return NextResponse.json({ error: "Recording is too large (max 10MB)." }, { status: 400 });
    }

    // Build multipart form for ElevenLabs
    const elForm = new FormData();
    elForm.append("name", name);
    elForm.append("files", audio, "recording.webm");
    elForm.append("remove_background_noise", "true");
    elForm.append("description", `HomeVoice clone for user ${user.id}`);

    const elRes = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: elForm,
    });

    if (!elRes.ok) {
      const err = await elRes.text().catch(() => "");
      console.error("[voice/clone] ElevenLabs error:", elRes.status, err);
      return NextResponse.json(
        { error: `Voice cloning failed: ${elRes.status}` },
        { status: 502 }
      );
    }

    const { voice_id } = await elRes.json() as { voice_id: string };

    // Save voice_id to profile
    const service = createServiceClient();
    const { error: updateError } = await service
      .from("profiles")
      .update({ cloned_voice_id: voice_id, cloned_voice_name: name })
      .eq("id", user.id);

    if (updateError) {
      console.error("[voice/clone] profile update error:", updateError);
      // Still return the voice_id even if saving failed
    }

    return NextResponse.json({ voice_id, name });
  } catch (err) {
    console.error("[voice/clone] error:", err);
    return NextResponse.json({ error: "Voice cloning failed." }, { status: 500 });
  }
}
