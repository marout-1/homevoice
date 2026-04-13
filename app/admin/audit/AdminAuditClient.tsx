"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface AuditEvent {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  admin_id: string;
  admin_email: string;
  target_user_id: string | null;
  target_email: string | null;
}

const ACTION_META: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  suspend:    { label: "Suspended",    color: "text-amber-700",  icon: "🚫", bg: "bg-amber-50 border-amber-200" },
  unsuspend:  { label: "Unsuspended",  color: "text-emerald-700",icon: "✅", bg: "bg-emerald-50 border-emerald-200" },
  delete:     { label: "Deleted",      color: "text-red-700",    icon: "🗑️", bg: "bg-red-50 border-red-200" },
  restore:    { label: "Restored",     color: "text-emerald-700",icon: "♻️", bg: "bg-emerald-50 border-emerald-200" },
  note:       { label: "Note added",   color: "text-blue-700",   icon: "📝", bg: "bg-blue-50 border-blue-200" },
  plan:       { label: "Plan changed", color: "text-purple-700", icon: "⭐", bg: "bg-purple-50 border-purple-200" },
};

export default function AdminAuditClient({
  initialEvents,
  initialTotal,
}: {
  initialEvents: AuditEvent[];
  initialTotal: number;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit?page=${p}&limit=${limit}`);
      const data = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-[#1B2B4B] text-xl">Audit Log</h1>
        <span className="text-sm text-[#1B2B4B]/40">{total.toLocaleString()} events</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[#1B2B4B]/30 text-sm">Loading…</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-[#1B2B4B]/40 text-sm">No audit events yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E8E4DC]">
            {events.map(evt => {
              const meta = ACTION_META[evt.action] ?? { label: evt.action, color: "text-[#1B2B4B]/60", icon: "•", bg: "bg-[#F5F3EF] border-[#E8E4DC]" };
              return (
                <div key={evt.id} className="px-6 py-4 flex items-start gap-4 hover:bg-[#FAFAF8] transition-colors">
                  <div className={`mt-0.5 w-8 h-8 rounded-full border flex items-center justify-center text-sm flex-shrink-0 ${meta.bg}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-semibold ${meta.color}`}>{meta.label}</span>
                      {evt.target_email && (
                        <Link
                          href={`/admin/users/${evt.target_user_id}`}
                          className="text-sm text-[#1B2B4B] hover:text-[#1A7A6E] font-medium transition-colors"
                        >
                          {evt.target_email}
                        </Link>
                      )}
                    </div>
                    {evt.details && Object.keys(evt.details).length > 0 && (
                      <p className="text-xs text-[#1B2B4B]/45 mt-0.5">
                        {Object.entries(evt.details).map(([k, v]) => `${k}: ${String(v)}`).join(" · ")}
                      </p>
                    )}
                    <p className="text-xs text-[#1B2B4B]/30 mt-1">
                      by {evt.admin_email} · {new Date(evt.created_at).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-[#E8E4DC] flex items-center justify-between">
            <p className="text-xs text-[#1B2B4B]/40">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => fetchPage(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-[#E8E4DC] rounded-lg text-[#1B2B4B]/60 hover:bg-[#F5F3EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>
              <button type="button" onClick={() => fetchPage(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-[#E8E4DC] rounded-lg text-[#1B2B4B]/60 hover:bg-[#F5F3EF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
