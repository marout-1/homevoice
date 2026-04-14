import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Reset monthly counter if needed
  if (profile?.usage_reset_at && new Date(profile.usage_reset_at) <= new Date()) {
    await supabase
      .from("profiles")
      .update({
        podcasts_this_month: 0,
        usage_reset_at: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      })
      .eq("id", user.id);
    if (profile) profile.podcasts_this_month = 0;
  }

  // Fetch podcast history
  const { data: podcasts } = await supabase
    .from("podcasts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <DashboardClient
      user={{ id: user.id, email: user.email ?? "", is_admin: profile?.is_admin ?? false }}
      profile={profile ?? { brand_name: "HomeVoice", plan: "free", podcasts_this_month: 0 }}
      podcasts={podcasts ?? []}
    />
  );
}
