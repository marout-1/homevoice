import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!adminProfile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const offset = (page - 1) * limit;

  const { data: events, count } = await supabase
    .from("audit_events")
    .select("id, action, details, created_at, admin_id, target_user_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  // Enrich with emails from profiles
  const adminIds = [...new Set((events ?? []).map(e => e.admin_id))];
  const targetIds = [...new Set((events ?? []).map(e => e.target_user_id).filter(Boolean))];
  const allIds = [...new Set([...adminIds, ...targetIds])];

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

  return NextResponse.json({ events: enriched, total: count ?? 0, page, limit });
}
