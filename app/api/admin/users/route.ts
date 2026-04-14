import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/app/lib/supabase/server";

// GET /api/admin/users?search=&status=&page=&limit=
export async function GET(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!adminProfile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "all";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("profiles")
    .select("id, email, brand_name, plan, status, is_admin, podcasts_this_month, suspended_at, suspended_reason, deleted_at, admin_notes, created_at, updated_at", { count: "exact" });

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }
  if (status !== "all") {
    query = query.eq("status", status);
  }

  query = query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data: profiles, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with podcast counts
  const enriched = await Promise.all((profiles ?? []).map(async (p) => {
    const { count: podCount } = await supabase
      .from("podcasts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", p.id);
    return { ...p, total_podcasts: podCount ?? 0 };
  }));

  return NextResponse.json({ users: enriched, total: count ?? 0, page, limit });
}
