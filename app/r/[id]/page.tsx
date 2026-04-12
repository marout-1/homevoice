/**
 * app/r/[id]/page.tsx
 * Public shareable page for a HomeVoice podcast report.
 * No auth required — any report with is_public = true is viewable here.
 * URL: /r/[podcast-id]
 */

import { createClient } from "@/app/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import SharePlayer from "./SharePlayer";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(n: number | null): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("podcasts")
    .select("address, city, state, zestimate")
    .eq("id", id)
    .single();

  if (!data) return { title: "HomeVoice Report" };

  const title = `${data.address} — HomeVoice Market Report`;
  const description = `AI-narrated real estate market report for ${data.address}, ${data.city}, ${data.state}. Powered by HomeVoice.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function SharePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch the podcast — no auth check, public read
  // Note: Supabase RLS must allow public SELECT on podcasts where the row exists.
  // Run this in your Supabase dashboard SQL editor:
  //   CREATE POLICY "Public podcast read" ON podcasts
  //   FOR SELECT USING (true);
  const { data: pod, error } = await supabase
    .from("podcasts")
    .select("id, address, city, state, zestimate, script_text, brand_name, created_at, data_source")
    .eq("id", id)
    .single();

  if (error || !pod) {
    notFound();
  }

  const isDemo = String(pod.data_source || "").toLowerCase().includes("demo");

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <nav className="bg-white border-b border-[#E8E4DC] px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1A7A6E] rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <span className="font-bold text-[#1B2B4B]">HomeVoice</span>
          </Link>
          <Link
            href="/signup"
            className="bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Generate your own →
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-5">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 bg-[#EDF4F3] border border-[#1A7A6E]/20 text-[#1A7A6E] text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <span className="w-1.5 h-1.5 bg-[#1A7A6E] rounded-full"></span>
            AI Market Report
          </div>
          <h1 className="text-2xl font-bold text-[#1B2B4B] mb-1">{pod.address}</h1>
          <p className="text-[#1B2B4B]/45">
            {pod.city && pod.state ? `${pod.city}, ${pod.state} · ` : ""}
            {new Date(pod.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Demo data warning */}
        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Sample data</p>
              <p className="text-amber-700 text-sm mt-0.5">This report uses sample property data and does not reflect real figures for this address.</p>
            </div>
          </div>
        )}

        {/* Property stats */}
        <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
          <h2 className="font-bold text-[#1B2B4B] mb-4">Property Summary</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F5F3EF] rounded-xl p-3">
              <p className="text-xs text-[#1B2B4B]/40 mb-1">Est. Value</p>
              <p className="font-bold text-[#1B2B4B]">{formatCurrency(pod.zestimate)}</p>
            </div>
            <div className="bg-[#F5F3EF] rounded-xl p-3">
              <p className="text-xs text-[#1B2B4B]/40 mb-1">Location</p>
              <p className="font-bold text-[#1B2B4B] text-sm">{pod.city}, {pod.state}</p>
            </div>
          </div>
        </div>

        {/* Audio player (client component) */}
        {pod.script_text && (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
            <h2 className="font-bold text-[#1B2B4B] mb-4">🎧 Listen to the Report</h2>
            <SharePlayer scriptText={pod.script_text} />
          </div>
        )}

        {/* Script */}
        {pod.script_text && (
          <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
            <h2 className="font-bold text-[#1B2B4B] mb-4">📄 Full Script</h2>
            <p className="text-sm text-[#1B2B4B]/60 leading-relaxed whitespace-pre-wrap">{pod.script_text}</p>
          </div>
        )}

        {/* Attribution + CTA */}
        <div className="bg-[#1B2B4B] rounded-2xl p-6 text-center">
          <p className="text-white font-bold mb-1">
            {pod.brand_name ? `Brought to you by ${pod.brand_name}` : "Powered by HomeVoice"}
          </p>
          <p className="text-white/40 text-sm mb-4">AI-generated market reports for real estate professionals.</p>
          <Link
            href="/signup"
            className="inline-block bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors"
          >
            Create your own free report →
          </Link>
        </div>

        <p className="text-xs text-[#1B2B4B]/25 text-center">
          This report is for informational purposes only and is not financial or appraisal advice.
        </p>
      </div>
    </div>
  );
}
