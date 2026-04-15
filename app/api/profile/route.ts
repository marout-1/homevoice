/**
 * app/api/profile/route.ts
 * User profile update endpoint — called by the client for self-service profile changes.
 *
 * PATCH { onboarding_clone_dismissed?: boolean }
 * Returns { success: true } or { error: string }
 *
 * Only whitelisted fields can be updated through this route.
 * Sensitive fields (plan, is_admin, etc.) are admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

// Fields the user is allowed to update themselves
const ALLOWED_FIELDS = new Set([
  "onboarding_clone_dismissed",
  "brand_name",
]);

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Filter to only allowed fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (updateErr) {
      console.error("[profile PATCH] update error:", updateErr);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile PATCH] unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
