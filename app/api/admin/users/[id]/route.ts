import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/app/lib/supabase/server";

async function requireAdmin() {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return null;
  const supabase = createServiceClient();
  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return null;
  return user;
}

// GET /api/admin/users/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  return NextResponse.json({ profile, podcasts: podcasts ?? [], auditEvents: auditEvents ?? [] });
}

// PATCH /api/admin/users/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient();
  const body = await req.json();
  const { action } = body;

  let profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let auditDetails: Record<string, unknown> = {};

  switch (action) {
    case "suspend":
      profileUpdate = { ...profileUpdate, status: "suspended", suspended_at: new Date().toISOString(), suspended_reason: body.reason ?? "" };
      auditDetails = { reason: body.reason ?? "" };
      break;
    case "unsuspend":
      profileUpdate = { ...profileUpdate, status: "active", suspended_at: null, suspended_reason: null };
      break;
    case "delete":
      profileUpdate = { ...profileUpdate, status: "deleted", deleted_at: new Date().toISOString() };
      break;
    case "restore":
      profileUpdate = { ...profileUpdate, status: "active", deleted_at: null };
      break;
    case "note":
      profileUpdate = { ...profileUpdate, admin_notes: body.note ?? "" };
      auditDetails = { note: body.note ?? "" };
      break;
    case "plan":
      profileUpdate = { ...profileUpdate, plan: body.plan };
      auditDetails = { plan: body.plan };
      break;
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await supabase.from("audit_events").insert({
    admin_id: admin.id,
    target_user_id: id,
    action,
    details: auditDetails,
  });

  return NextResponse.json({ success: true });
}
