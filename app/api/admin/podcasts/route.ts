import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/app/lib/supabase/server";

async function requireAdmin() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401, adminId: null };

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return { error: "Forbidden", status: 403, adminId: null };
  return { error: null, status: 200, adminId: user.id };
}

// DELETE /api/admin/podcasts
// Body: { podcastIds: string[], userId: string }
// Deletes the specified podcasts and recalculates podcasts_this_month for the user
export async function DELETE(req: NextRequest) {
  const { error, status, adminId } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const { podcastIds, userId } = await req.json();

  if (!Array.isArray(podcastIds) || podcastIds.length === 0) {
    return NextResponse.json({ error: "No podcast IDs provided" }, { status: 400 });
  }
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Delete the podcasts
  const { error: deleteErr, count } = await supabase
    .from("podcasts")
    .delete({ count: "exact" })
    .in("id", podcastIds)
    .eq("user_id", userId); // safety: only delete podcasts belonging to this user

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // Recalculate podcasts_this_month from remaining rows this calendar month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: remaining } = await supabase
    .from("podcasts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  await supabase
    .from("profiles")
    .update({ podcasts_this_month: remaining ?? 0 })
    .eq("id", userId);

  // Log to audit
  await supabase.from("audit_events").insert({
    admin_id: adminId,
    target_user_id: userId,
    action: "podcasts_deleted",
    details: {
      deleted_count: count ?? podcastIds.length,
      podcast_ids: podcastIds,
      new_monthly_count: remaining ?? 0,
    },
  });

  return NextResponse.json({
    success: true,
    deleted: count ?? podcastIds.length,
    newMonthlyCount: remaining ?? 0,
  });
}
