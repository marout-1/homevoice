"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  email: string;
  brand_name: string;
  plan: string;
  status: string;
  is_admin: boolean;
  podcasts_this_month: number;
  suspended_at: string | null;
  suspended_reason: string | null;
  deleted_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Podcast {
  id: string;
  address: string;
  city: string;
  state: string;
  zestimate: number | null;
  created_at: string;
}

interface AuditEvent {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  admin_id: string;
  admin_email: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  suspend:          { label: "Suspended",        color: "text-amber-600",  icon: "🚫" },
  unsuspend:        { label: "Unsuspended",      color: "text-emerald-600",icon: "✅" },
  delete:           { label: "Deleted",          color: "text-red-600",    icon: "🗑️" },
  restore:          { label: "Restored",         color: "text-emerald-600",icon: "♻️" },
  note:             { label: "Note added",       color: "text-blue-600",   icon: "📝" },
  plan:             { label: "Plan changed",     color: "text-purple-600", icon: "⭐" },
  podcasts_deleted: { label: "Podcasts deleted", color: "text-red-500",    icon: "🎙️" },
};

function formatCurrency(n: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export default function AdminUserDetailClient({
  profile: initialProfile,
  podcasts: initialPodcasts,
  auditEvents: initialAuditEvents,
}: {
  profile: Profile;
  podcasts: Podcast[];
  auditEvents: AuditEvent[];
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [podcasts, setPodcasts] = useState(initialPodcasts);
  const [auditEvents, setAuditEvents] = useState(initialAuditEvents);
  const [loading, setLoading] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeletePodcastsModal, setShowDeletePodcastsModal] = useState(false);
  const [adminNote, setAdminNote] = useState(profile.admin_notes ?? "");
  const [noteSaved, setNoteSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Podcast bulk selection
  const [selectedPodcastIds, setSelectedPodcastIds] = useState<Set<string>>(new Set());
  const allSelected = podcasts.length > 0 && selectedPodcastIds.size === podcasts.length;
  const someSelected = selectedPodcastIds.size > 0;

  function togglePodcast(id: string) {
    setSelectedPodcastIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedPodcastIds(new Set());
    } else {
      setSelectedPodcastIds(new Set(podcasts.map(p => p.id)));
    }
  }

  async function deleteSelectedPodcasts() {
    setLoading("delete_podcasts");
    setError(null);
    setShowDeletePodcastsModal(false);
    try {
      const res = await fetch("/api/admin/podcasts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ podcastIds: Array.from(selectedPodcastIds), userId: profile.id }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Delete failed"); return; }

      // Remove deleted podcasts from local state
      setPodcasts(prev => prev.filter(p => !selectedPodcastIds.has(p.id)));
      setSelectedPodcastIds(new Set());

      // Update the monthly count shown in the profile card
      setProfile(p => ({ ...p, podcasts_this_month: data.newMonthlyCount }));

      // Add optimistic audit event
      setAuditEvents(evts => [{
        id: crypto.randomUUID(),
        action: "podcasts_deleted",
        details: { deleted_count: data.deleted, new_monthly_count: data.newMonthlyCount },
        created_at: new Date().toISOString(),
        admin_id: "",
        admin_email: "you",
      }, ...evts]);

      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Action failed"); return; }
      // Refresh data
      router.refresh();
      // Optimistically update profile status
      const statusMap: Record<string, Partial<Profile>> = {
        suspend:   { status: "suspended", suspended_at: new Date().toISOString(), suspended_reason: extra?.reason as string ?? "" },
        unsuspend: { status: "active", suspended_at: null, suspended_reason: null },
        delete:    { status: "deleted", deleted_at: new Date().toISOString() },
        restore:   { status: "active", deleted_at: null },
        plan:      { plan: extra?.plan as string },
      };
      if (statusMap[action]) setProfile(p => ({ ...p, ...statusMap[action] }));
      // Add optimistic audit event
      const meta = ACTION_LABELS[action];
      setAuditEvents(evts => [{
        id: crypto.randomUUID(),
        action,
        details: extra ?? {},
        created_at: new Date().toISOString(),
        admin_id: "",
        admin_email: "you",
      }, ...evts]);
    } finally {
      setLoading(null);
    }
  }

  async function saveNote() {
    setLoading("note");
    await doAction("note", { note: adminNote });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  const isSuspended = profile.status === "suspended";
  const isDeleted = profile.status === "deleted";

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#1B2B4B]/40">
        <Link href="/admin" className="hover:text-[#1B2B4B] transition-colors">Users</Link>
        <span>/</span>
        <span className="text-[#1B2B4B]">{profile.email}</span>
      </div>

      {/* Status banner */}
      {isSuspended && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">Account suspended</p>
            {profile.suspended_reason && <p className="text-amber-700 text-xs mt-0.5">Reason: {profile.suspended_reason}</p>}
          </div>
        </div>
      )}
      {isDeleted && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-xl">🗑️</span>
          <p className="font-semibold text-red-700 text-sm">Account soft-deleted on {new Date(profile.deleted_at!).toLocaleDateString()}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column: profile + actions */}
        <div className="lg:col-span-2 space-y-5">

          {/* Profile card */}
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h1 className="font-bold text-[#1B2B4B] text-xl flex items-center gap-2">
                  {profile.email}
                  {profile.is_admin && <span className="text-xs bg-[#1B2B4B] text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
                </h1>
                <p className="text-sm text-[#1B2B4B]/40 mt-0.5">ID: {profile.id}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  profile.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  profile.status === "suspended" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-red-50 text-red-600 border-red-200"
                }`}>{profile.status ?? "active"}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  profile.plan === "pro" ? "bg-[#1B2B4B] text-white" : "bg-[#F5F3EF] text-[#1B2B4B]/50 border border-[#E8E4DC]"
                }`}>{profile.plan === "pro" ? "PRO" : "Free"}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {[
                { label: "Brand name", value: profile.brand_name || "—" },
                { label: "Podcasts this month", value: `${profile.podcasts_this_month} / ${profile.plan === "pro" ? "∞" : "100"}` },
                { label: "Joined", value: new Date(profile.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
              ].map(s => (
                <div key={s.label} className="bg-[#F5F3EF] rounded-xl p-3">
                  <p className="text-xs text-[#1B2B4B]/40 mb-1">{s.label}</p>
                  <p className="font-semibold text-[#1B2B4B] text-sm">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Plan change */}
            <div className="flex items-center gap-2 pt-4 border-t border-[#E8E4DC]">
              <span className="text-sm text-[#1B2B4B]/50 font-medium">Plan:</span>
              <button
                type="button"
                onClick={() => doAction("plan", { plan: profile.plan === "pro" ? "free" : "pro" })}
                disabled={loading === "plan"}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                  profile.plan === "pro"
                    ? "bg-[#F5F3EF] text-[#1B2B4B]/60 border-[#E8E4DC] hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    : "bg-[#1B2B4B] text-white border-[#1B2B4B] hover:bg-[#1B2B4B]/80"
                }`}
              >
                {loading === "plan" ? "…" : profile.plan === "pro" ? "Downgrade to Free" : "Upgrade to Pro"}
              </button>
            </div>
          </div>

          {/* Podcast history with bulk delete */}
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E8E4DC] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {podcasts.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-[#E8E4DC] cursor-pointer accent-[#1A7A6E]"
                  />
                )}
                <h3 className="font-semibold text-[#1B2B4B]">Podcasts ({podcasts.length})</h3>
                {someSelected && (
                  <span className="text-xs text-[#1B2B4B]/50">{selectedPodcastIds.size} selected</span>
                )}
              </div>
              {someSelected && (
                <button
                  type="button"
                  onClick={() => setShowDeletePodcastsModal(true)}
                  disabled={loading === "delete_podcasts"}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                >
                  {loading === "delete_podcasts" ? "Deleting…" : `🗑️ Delete ${selectedPodcastIds.size} podcast${selectedPodcastIds.size !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
            {podcasts.length === 0 ? (
              <div className="p-8 text-center text-[#1B2B4B]/30 text-sm">No podcasts yet</div>
            ) : (
              <div className="divide-y divide-[#E8E4DC]">
                {podcasts.map(pod => (
                  <div
                    key={pod.id}
                    onClick={() => togglePodcast(pod.id)}
                    className={`px-6 py-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                      selectedPodcastIds.has(pod.id) ? "bg-red-50" : "hover:bg-[#FAFAF8]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPodcastIds.has(pod.id)}
                      onChange={() => togglePodcast(pod.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded border-[#E8E4DC] cursor-pointer accent-[#1A7A6E] flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#1B2B4B] truncate">{pod.address}</p>
                      <p className="text-xs text-[#1B2B4B]/40 mt-0.5">
                        {pod.city && pod.state ? `${pod.city}, ${pod.state} · ` : ""}
                        {formatCurrency(pod.zestimate)}
                      </p>
                    </div>
                    <p className="text-xs text-[#1B2B4B]/30 flex-shrink-0">
                      {new Date(pod.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: actions + notes */}
        <div className="space-y-5">

          {/* Actions */}
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
            <h3 className="font-semibold text-[#1B2B4B] mb-4">Actions</h3>
            <div className="space-y-2">
              {!isDeleted && (
                isSuspended ? (
                  <button
                    type="button"
                    onClick={() => doAction("unsuspend")}
                    disabled={loading === "unsuspend"}
                    className="w-full text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                  >
                    {loading === "unsuspend" ? "…" : "✅ Unsuspend account"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSuspendModal(true)}
                    className="w-full text-sm font-semibold py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                  >
                    🚫 Suspend account
                  </button>
                )
              )}

              {isDeleted ? (
                <button
                  type="button"
                  onClick={() => doAction("restore")}
                  disabled={loading === "restore"}
                  className="w-full text-sm font-semibold py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                >
                  {loading === "restore" ? "…" : "♻️ Restore account"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full text-sm font-semibold py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  🗑️ Soft delete account
                </button>
              )}
            </div>
          </div>

          {/* Admin notes */}
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
            <h3 className="font-semibold text-[#1B2B4B] mb-3">Admin Notes</h3>
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Internal notes about this user…"
              rows={4}
              className="w-full border border-[#E8E4DC] rounded-xl px-3 py-2.5 text-sm text-[#1B2B4B] placeholder-[#1B2B4B]/25 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent resize-none"
            />
            <button
              type="button"
              onClick={saveNote}
              disabled={loading === "note"}
              className="mt-2 w-full text-sm font-semibold py-2 rounded-xl bg-[#1A7A6E] hover:bg-[#15695F] text-white transition-colors disabled:opacity-50"
            >
              {noteSaved ? "✓ Saved" : loading === "note" ? "Saving…" : "Save note"}
            </button>
          </div>

          {/* Audit timeline */}
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-5">
            <h3 className="font-semibold text-[#1B2B4B] mb-4">Activity</h3>
            {auditEvents.length === 0 ? (
              <p className="text-sm text-[#1B2B4B]/30">No admin actions yet</p>
            ) : (
              <div className="space-y-3">
                {auditEvents.map(evt => {
                  const meta = ACTION_LABELS[evt.action] ?? { label: evt.action, color: "text-[#1B2B4B]/60", icon: "•" };
                  return (
                    <div key={evt.id} className="flex items-start gap-2.5">
                      <span className="text-base mt-0.5">{meta.icon}</span>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
                        {evt.details && Object.keys(evt.details).length > 0 && (
                          <p className="text-xs text-[#1B2B4B]/40 truncate mt-0.5">
                            {Object.entries(evt.details).map(([k, v]) => `${k}: ${v}`).join(", ")}
                          </p>
                        )}
                        <p className="text-xs text-[#1B2B4B]/25 mt-0.5">
                          {evt.admin_email} · {new Date(evt.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suspend modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-bold text-[#1B2B4B] mb-1">Suspend account</h3>
            <p className="text-sm text-[#1B2B4B]/50 mb-4">This will prevent <strong>{profile.email}</strong> from logging in.</p>
            <label className="block text-xs font-semibold text-[#1B2B4B] mb-1.5">Reason (optional)</label>
            <textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="e.g. Violation of terms of service"
              rows={3}
              className="w-full border border-[#E8E4DC] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowSuspendModal(false)} className="flex-1 text-sm py-2.5 rounded-xl border border-[#E8E4DC] text-[#1B2B4B]/60 hover:bg-[#F5F3EF] transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => { setShowSuspendModal(false); await doAction("suspend", { reason: suspendReason }); }}
                disabled={loading === "suspend"}
                className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-colors"
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete podcasts confirmation modal */}
      {showDeletePodcastsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-bold text-[#1B2B4B] mb-1">Delete {selectedPodcastIds.size} podcast{selectedPodcastIds.size !== 1 ? "s" : ""}?</h3>
            <p className="text-sm text-[#1B2B4B]/50 mb-1">
              This will permanently delete the selected podcasts for <strong>{profile.email}</strong> and update their monthly count.
            </p>
            <p className="text-xs text-red-500 mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeletePodcastsModal(false)}
                className="flex-1 text-sm py-2.5 rounded-xl border border-[#E8E4DC] text-[#1B2B4B]/60 hover:bg-[#F5F3EF] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteSelectedPodcasts}
                className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-2xl max-w-sm w-full p-6">
            <h3 className="font-bold text-[#1B2B4B] mb-1">Soft delete account</h3>
            <p className="text-sm text-[#1B2B4B]/50 mb-1">
              This marks <strong>{profile.email}</strong> as deleted. The data is retained and can be restored.
            </p>
            <p className="text-xs text-[#1B2B4B]/35 mb-4">This is reversible — it does not erase any data.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 text-sm py-2.5 rounded-xl border border-[#E8E4DC] text-[#1B2B4B]/60 hover:bg-[#F5F3EF] transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => { setShowDeleteModal(false); await doAction("delete"); }}
                className="flex-1 text-sm font-semibold py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
