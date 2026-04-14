import { createServiceClient } from "@/app/lib/supabase/server";
import AdminUsersClient from "./AdminUsersClient";

export default async function AdminPage() {
  const supabase = createServiceClient();

  // Fetch all users for initial load
  const { data: profiles, count } = await supabase
    .from("profiles")
    .select("id, email, brand_name, plan, status, is_admin, podcasts_this_month, suspended_at, created_at, updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(20);

  // Stats
  const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: proUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("plan", "pro");
  const { count: suspendedUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "suspended");
  const { count: totalPodcasts } = await supabase.from("podcasts").select("*", { count: "exact", head: true });

  // Enrich with podcast counts
  const enriched = await Promise.all((profiles ?? []).map(async (p) => {
    const { count: podCount } = await supabase
      .from("podcasts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p.id);
    return { ...p, total_podcasts: podCount ?? 0 };
  }));

  const stats = {
    totalUsers: totalUsers ?? 0,
    proUsers: proUsers ?? 0,
    suspendedUsers: suspendedUsers ?? 0,
    totalPodcasts: totalPodcasts ?? 0,
  };

  return <AdminUsersClient initialUsers={enriched} initialTotal={count ?? 0} stats={stats} />;
}
