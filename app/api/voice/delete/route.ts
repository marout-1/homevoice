/**
 * app/api/voice/delete/route.ts
 * Deletes the user's cloned voice from ElevenLabs and clears it from their profile.
 * DELETE → { success: true }
 */

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/app/lib/supabase/server";

export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current voice_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("cloned_voice_id")
      .eq("id", user.id)
      .single();

    const voiceId = profile?.cloned_voice_id;

    // Delete from ElevenLabs
    if (voiceId) {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (apiKey) {
        const elRes = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
          method: "DELETE",
          headers: { "xi-api-key": apiKey },
        });
        if (!elRes.ok) {
          console.warn("[voice/delete] ElevenLabs delete failed:", elRes.status);
        }
      }
    }

    // Clear from profile
    const service = createServiceClient();
    await service
      .from("profiles")
      .update({ cloned_voice_id: null, cloned_voice_name: null })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[voice/delete] error:", err);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
