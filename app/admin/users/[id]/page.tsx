import { createServiceClient } from "@/app/lib/supabase/server";
import { notFound } from "next/navigation";
import AdminUserDetailClient from "./AdminUserDetailClient";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !profile) notFound();

  const { data: podcasts } = await supabase
    .from("podcasts")
    .select("id, address, city, state, zestimate, created_at")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: auditEvents } = await supabase
    .from("audit_events")
    .select("id, action, details, created_at, admin_id")
    .eq("target_user_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Enrich audit events with admin emails
  const adminIds = [...new Set((auditEvents ?? []).map(e => e.admin_id))];
  const { data: adminProfiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", adminIds);

  const adminEmailMap: Record<string, string> = {};
  (adminProfiles ?? []).forEach(p => { adminEmailMap[p.id] = p.email ?? p.id; });

  const enrichedEvents = (auditEvents ?? []).map(e => ({
    ...e,
    admin_email: adminEmailMap[e.admin_id] ?? e.admin_id,
  }));

  return (
    <AdminUserDetailClient
      profile={profile}
      podcasts={podcasts ?? []}
      auditEvents={enrichedEvents}
    />
  );
}
