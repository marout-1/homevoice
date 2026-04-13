"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";

interface AdminUser {
  id: string;
  email: string;
  brand_name: string;
  plan: string;
  status: string;
  is_admin: boolean;
  podcasts_this_month: number;
  total_podcasts: number;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
  totalUsers: number;
  proUsers: number;
  suspendedUsers: number;
  totalPodcasts: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    suspended: "bg-amber-50 text-amber-700 border-amber-200",
    deleted: "bg-red-50 text-red-600 border-red-200",
  };
  const labels: Record<string, string> = { active: "Active", suspended: "Suspended", deleted: "Deleted" };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status] ?? styles.active}`}>
      {labels[status] ?? status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return plan === "pro" ? (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#1B2B4B] text-white">PRO</span>
  ) : (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F5F3EF] text-[#1B2B4B]/50 border border-[#E8E4DC]">Free</span>
  );
}

export default function AdminUsersClient({
  initialUsers,
  initialTotal,
  stats,
}: {
  initialUsers: AdminUser[];
  initialTotal: number;
  stats: Stats;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limit = 20;

  const fetchUsers = useCallback(async (q: string, status: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: q, status, page: String(p), limit: String(limit) });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(val: string) {
    setSearch(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchUsers(val, statusFilter, 1), 300);
  }

  function handleStatusFilter(val: string) {
    setStatusFilter(val);
    fetchUsers(search, val, 1);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.totalUsers, icon: "👥" },
          { label: "Pro Users", value: stats.proUsers, icon: "⭐" },
          { label: "Suspended", value: stats.suspendedUsers, icon: "⚠️" },
          { label: "Total Podcasts", value: stats.totalPodcasts, icon: "🎙️" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold text-[#1B2B4B]">{s.value.toLocaleString()}</p>
            <p className="text-xs text-[#1B2B4B]/45 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
          <h2 className="font-bold text-[#1B2B4B] text-lg">Users</h2>
          <div className="flex items-center gap-2 text-sm text-[#1B2B4B]/40">
            {total.toLocaleString()} {total === 1 ? "user" : "users"}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1B2B4B]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by email…"
              className="w-full pl-9 pr-4 py-2.5 border border-[#E8E4DC] rounded-xl text-sm text-[#1B2B4B] placeholder-[#1B2B4B]/30 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1 bg-[#F5F3EF] border border-[#E8E4DC] p-1 rounded-xl">
            {(["all", "active", "suspended", "deleted"] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => handleStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  statusFilter === s
                    ? "bg-white text-[#1B2B4B] shadow-sm border border-[#E8E4DC]"
                    : "text-[#1B2B4B]/45 hover:text-[#1B2B4B]/70"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User table */}
      <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#1B2B4B]/30 text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">👤</p>
            <p className="text-[#1B2B4B]/40 text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E4DC] bg-[#FAFAF8]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#1B2B4B]/40 uppercase tracking-wide">User</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#1B2B4B]/40 uppercase tracking-wide">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#1B2B4B]/40 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#1B2B4B]/40 uppercase tracking-wide">Podcasts</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#1B2B4B]/40 uppercase tracking-wide">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E4DC]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#FAFAF8] transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-medium text-[#1B2B4B] flex items-center gap-1.5">
                          {u.email}
                          {u.is_admin && <span className="text-xs bg-[#1B2B4B] text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                        </p>
                        {u.brand_name && u.brand_name !== "HomeVoice" && (
                          <p className="text-xs text-[#1B2B4B]/35 mt-0.5">{u.brand_name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><PlanBadge plan={u.plan} /></td>
                    <td className="px-4 py-3.5"><StatusBadge status={u.status ?? "active"} /></td>
                    <td className="px-4 py-3.5">
                      <span className="text-[#1B2B4B]/60">{u.total_podcasts}</span>
                      <span className="text-[#1B2B4B]/25 text-xs ml-1">({u.podcasts_this_month} mo)</span>
                    </td>
                    <td className="px-4 py-3.5 text-[#1B2B4B]/40 text-xs">
                      {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs font-semibold text-[#1A7A6E] hover:text-[#15695F] transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-[#E8E4DC] flex items-center justify-between">
            <p className="text-xs text-[#1B2B4B]/40">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchUsers(search, statusFilter, page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-[#E8E4DC] rounded-lg text-[#1B2B4B]/60 hover:bg-[#F5F3EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Prev
              </button>
              <button
                type="button"
                onClick={() => fetchUsers(search, statusFilter, page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-[#E8E4DC] rounded-lg text-[#1B2B4B]/60 hover:bg-[#F5F3EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
