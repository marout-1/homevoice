import { createClient } from "@/app/lib/supabase/server";
import AdminAuditClient from "./AdminAuditClient";

export default async function AdminAuditPage() {
  const supabase = await createClient();

  const { data: events, count } = await supabase
    .from("audit_events")
    .select("id, action, details, created_at, admin_id, target_user_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  // Enrich with emails
  const allIds = [...new Set([
    ...(events ?? []).map(e => e.admin_id),
    ...(events ?? []).map(e => e.target_user_id).filter(Boolean),
  ])];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .in("id", allIds);

  const emailMap: Record<string, string> = {};
  (profiles ?? []).forEach(p => { emailMap[p.id] = p.email ?? p.id; });

  const enriched = (events ?? []).map(e => ({
    ...e,
    admin_email: emailMap[e.admin_id] ?? e.admin_id,
    target_email: e.target_user_id ? (emailMap[e.target_user_id] ?? e.target_user_id) : null,
  }));

  return <AdminAuditClient initialEvents={enriched} initialTotal={count ?? 0} />;
}
