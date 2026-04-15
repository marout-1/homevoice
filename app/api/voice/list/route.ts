/**
 * app/api/voice/list/route.ts
 * Returns the user's saved cloned voice from their profile.
 * GET → { voice_id, name } or { voice_id: null }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("cloned_voice_id, cloned_voice_name")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      voice_id: profile?.cloned_voice_id ?? null,
      name: profile?.cloned_voice_name ?? null,
    });
  } catch (err) {
    console.error("[voice/list] error:", err);
    return NextResponse.json({ voice_id: null, name: null });
  }
}
