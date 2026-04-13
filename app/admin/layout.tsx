import { redirect } from "next/navigation";
import { createClient } from "@/app/lib/supabase/server";
import Link from "next/link";

export const metadata = { title: "Admin — HomeVoice" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check admin flag
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, email")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF] flex flex-col">
      {/* Top nav */}
      <nav className="bg-[#1B2B4B] px-6 py-3 fixed top-0 left-0 right-0 z-40 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#1A7A6E] rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
                </svg>
              </div>
              <span className="text-white font-bold text-sm">HomeVoice Admin</span>
            </Link>
            <div className="flex items-center gap-1">
              <NavLink href="/admin">Users</NavLink>
              <NavLink href="/admin/audit">Audit Log</NavLink>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white/40 text-xs">{profile.email}</span>
            <Link href="/dashboard" className="text-white/50 hover:text-white text-xs transition-colors">
              ← Back to app
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-[52px] flex-1">
        {children}
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-white/60 hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
    >
      {children}
    </Link>
  );
}
