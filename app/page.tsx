import Link from "next/link";
import { createClient } from "@/app/lib/supabase/server";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1B2B4B] font-sans">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#E8E4DC] bg-[#FAFAF8]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#1A7A6E] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22" fill="none" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
            <span className="font-bold text-[#1B2B4B] text-lg tracking-tight">HomeVoice</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#1B2B4B]/50">
            <a href="#how-it-works" className="hover:text-[#1B2B4B] transition-colors">How it works</a>
            <a href="#features" className="hover:text-[#1B2B4B] transition-colors">Features</a>
            <a href="#pricing" className="hover:text-[#1B2B4B] transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard" className="bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                Dashboard →
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-[#1B2B4B]/50 hover:text-[#1B2B4B] transition-colors font-medium">Sign in</Link>
                <Link href="/signup" className="bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                  Try free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Subtle background texture */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#EDF4F3] to-[#FAFAF8] pointer-events-none" />

        <div className="max-w-5xl mx-auto relative">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: copy */}
            <div className="flex-1 text-left">
              <div className="inline-flex items-center gap-2 bg-[#1A7A6E]/10 border border-[#1A7A6E]/20 text-[#1A7A6E] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 bg-[#1A7A6E] rounded-full animate-pulse"></span>
                10 free podcasts/month — no credit card
              </div>

              <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] tracking-tight mb-5 text-[#1B2B4B]">
                AI market reports<br/>
                your clients will<br/>
                <span className="text-[#1A7A6E]">actually listen to.</span>
              </h1>

              <p className="text-lg text-[#1B2B4B]/55 max-w-lg mb-8 leading-relaxed">
                Type in any U.S. property address. Get a professional, AI-narrated audio report covering valuation, comparable sales, and local market trends — ready to attach to your listing email in 90 seconds.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3 mb-6">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto bg-[#1A7A6E] hover:bg-[#15695F] text-white font-bold px-8 py-4 rounded-xl transition-colors text-base text-center"
                >
                  Generate your first report free →
                </Link>
                <a
                  href="#how-it-works"
                  className="w-full sm:w-auto bg-white hover:bg-gray-50 border border-[#E8E4DC] text-[#1B2B4B] font-medium px-8 py-4 rounded-xl transition-colors text-base text-center"
                >
                  See how it works
                </a>
              </div>
              <p className="text-xs text-[#1B2B4B]/30">Used by listing agents, buyer&apos;s agents, and marketing teams across the US.</p>
            </div>

            {/* Right: app mockup */}
            <div className="flex-1 w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-xl border border-[#E8E4DC] overflow-hidden">
                {/* Mock browser bar */}
                <div className="bg-[#F5F3EF] px-4 py-3 flex items-center gap-2 border-b border-[#E8E4DC]">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                    <div className="w-3 h-3 rounded-full bg-green-400/60" />
                  </div>
                  <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-[#1B2B4B]/30 ml-2 border border-[#E8E4DC]">
                    homevoice.app/dashboard
                  </div>
                </div>
                <div className="p-5">
                  {/* Address input */}
                  <div className="bg-[#F5F3EF] border border-[#1A7A6E]/30 rounded-xl p-4 mb-4">
                    <p className="text-xs text-[#1B2B4B]/40 mb-1 uppercase tracking-widest font-medium">Property Address</p>
                    <p className="text-[#1B2B4B] font-medium text-sm">1884 Fleming Woods Rd, Charleston, SC 29412</p>
                  </div>
                  {/* Property card */}
                  <div className="bg-[#F5F3EF] rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-[#1B2B4B]/40 mb-0.5">Est. Value</p>
                        <p className="font-bold text-[#1B2B4B] text-lg">$545,000</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-1 rounded-full font-semibold">+12% vs last sale</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[{l:"Beds",v:"3"},{l:"Baths",v:"2.5"},{l:"Sq Ft",v:"2,064"}].map(s => (
                        <div key={s.l} className="bg-white rounded-lg p-2">
                          <p className="text-xs text-[#1B2B4B]/40">{s.l}</p>
                          <p className="font-semibold text-[#1B2B4B] text-sm">{s.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Audio player */}
                  <div className="bg-[#1B2B4B] rounded-xl p-4">
                    <div className="flex items-center gap-1 justify-center mb-3 h-8">
                      {[3,5,8,12,16,14,9,6,14,18,12,7,15,19,11,6,13,17,10,5,12,16,9,5,11,14,8,4].map((h, i) => (
                        <div key={i} className="w-1 rounded-full" style={{
                          height: `${Math.min(h * 2, 32)}px`,
                          backgroundColor: i < 14 ? '#1A7A6E' : 'rgba(255,255,255,0.15)'
                        }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#1A7A6E] rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="h-1 bg-white/10 rounded-full">
                          <div className="h-full w-[38%] bg-[#1A7A6E] rounded-full" />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-white/30">0:58</span>
                          <span className="text-xs text-white/30">Charleston Market Report</span>
                          <span className="text-xs text-white/30">2:45</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof ────────────────────────────────────────────────── */}
      <section className="border-y border-[#E8E4DC] py-5 px-6 bg-white">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          <p className="text-xs text-[#1B2B4B]/30 uppercase tracking-widest font-semibold">Built for teams at</p>
          {["Compass", "Keller Williams", "RE/MAX", "Century 21", "Coldwell Banker"].map((co) => (
            <span key={co} className="text-[#1B2B4B]/20 text-sm font-semibold tracking-tight">{co}</span>
          ))}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-[#1B2B4B]">From address to audio in 90 seconds</h2>
            <p className="text-[#1B2B4B]/45 text-lg">No recording. No editing. No copywriting. Just results.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: "1", icon: "🏠", title: "Enter an address", desc: "Type any U.S. property address. We look up the rest automatically." },
              { n: "2", icon: "📊", title: "We pull the data", desc: "Live valuation, 3–5 nearby comps, and local market news — all fetched instantly." },
              { n: "3", icon: "✍️", title: "AI writes the script", desc: "A natural, engaging market report script tailored specifically to that property." },
              { n: "4", icon: "🎙️", title: "Play & share", desc: "Listen in your browser, download as MP3, or embed in your listing email." },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#EDF4F3] border border-[#1A7A6E]/20 flex items-center justify-center mx-auto mb-4 text-2xl">
                  {step.icon}
                </div>
                <div className="w-6 h-6 rounded-full bg-[#1A7A6E] text-white text-xs font-bold flex items-center justify-center mx-auto mb-3">
                  {step.n}
                </div>
                <h3 className="font-semibold text-[#1B2B4B] mb-2">{step.title}</h3>
                <p className="text-[#1B2B4B]/45 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use cases ───────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#FAFAF8]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-[#1B2B4B]">The content your clients actually engage with</h2>
            <p className="text-[#1B2B4B]/45 text-lg">Three workflows real estate professionals use every day.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "📬",
                title: "Listing emails",
                desc: "Attach a 90-second audio report to every new listing email. Buyers who listen stay engaged 3× longer than those who just read.",
                tag: "Most popular",
              },
              {
                icon: "🏡",
                title: "Open houses",
                desc: "Play the HomeVoice report on a loop at your open house. Buyers hear the comps and market story without you having to repeat it.",
                tag: "High impact",
              },
              {
                icon: "📈",
                title: "Monthly market updates",
                desc: "Generate a neighborhood market report every month and send it to your sphere. Stay top of mind with zero writing effort.",
                tag: "Client retention",
              },
            ].map((uc) => (
              <div key={uc.title} className="bg-white rounded-2xl border border-[#E8E4DC] p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{uc.icon}</span>
                  <span className="text-xs bg-[#EDF4F3] text-[#1A7A6E] border border-[#1A7A6E]/20 px-2 py-1 rounded-full font-semibold">{uc.tag}</span>
                </div>
                <h3 className="font-bold text-[#1B2B4B] text-lg mb-2">{uc.title}</h3>
                <p className="text-[#1B2B4B]/50 text-sm leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-white border-y border-[#E8E4DC]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
          {[
            {
              quote: "Our open rate on listing emails went up 34% when we started attaching the HomeVoice episode. Buyers actually listen.",
              name: "Sarah K.",
              role: "Marketing Director, Austin Brokerage",
            },
            {
              quote: "I generate one for every new listing. Takes 90 seconds and my sellers love that I'm going the extra mile.",
              name: "Marcus T.",
              role: "Listing Agent, Dallas TX",
            },
            {
              quote: "We use it for our monthly market update emails. Clients forward it to friends. Best content tool we've found.",
              name: "Priya L.",
              role: "Property Manager, Phoenix AZ",
            },
          ].map((t) => (
            <div key={t.name} className="bg-[#FAFAF8] border border-[#E8E4DC] rounded-2xl p-6">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-[#1A7A6E]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ))}
              </div>
              <p className="text-[#1B2B4B]/60 text-sm leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
              <div>
                <p className="text-[#1B2B4B] text-sm font-semibold">{t.name}</p>
                <p className="text-[#1B2B4B]/35 text-xs mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-[#FAFAF8]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-[#1B2B4B]">Everything you need, nothing you don&apos;t</h2>
            <p className="text-[#1B2B4B]/45 text-lg max-w-xl mx-auto">Real data, real voice, real results.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: "📊", title: "Live property data", desc: "Zestimate, last sale price, beds, baths, and square footage fetched automatically." },
              { icon: "🏘️", title: "Comparable sales", desc: "3–5 nearby recent comps woven into the script so listeners understand the market." },
              { icon: "📰", title: "Local market trends", desc: "Days on market, price direction, and recent news for the neighborhood." },
              { icon: "🎙️", title: "AI narration", desc: "Professional AI voice reads the script. Warm, clear, and ready to share." },
              { icon: "🏷️", title: "Your brand in every outro", desc: "Set your brokerage name once. Every report ends with your branded sign-off." },
              { icon: "⬇️", title: "Play, download, or embed", desc: "Browser playback, MP3 download, or embed in listing pages and emails." },
            ].map((f) => (
              <div key={f.title} className="bg-white hover:shadow-md transition-shadow border border-[#E8E4DC] rounded-2xl p-6">
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-[#1B2B4B] mb-2">{f.title}</h3>
                <p className="text-[#1B2B4B]/45 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6 bg-white border-t border-[#E8E4DC]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-[#1B2B4B]">Start free. Scale when you&apos;re ready.</h2>
            <p className="text-[#1B2B4B]/45 text-lg">No contracts. No credit card to start.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Free */}
            <div className="bg-[#FAFAF8] border border-[#E8E4DC] rounded-2xl p-8">
              <p className="text-xs font-semibold text-[#1B2B4B]/40 uppercase tracking-widest mb-3">Free forever</p>
              <p className="text-4xl font-bold text-[#1B2B4B] mb-1">$0</p>
              <p className="text-[#1B2B4B]/35 text-sm mb-8">No credit card needed</p>
              <ul className="space-y-3 mb-8">
                {["10 podcasts per month", "Full AI script generation", "AI voice narration", "Podcast history", "Your brand in every outro"].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-[#1B2B4B]/60">
                    <svg className="w-4 h-4 text-[#1A7A6E] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block w-full text-center border border-[#1B2B4B]/15 hover:border-[#1A7A6E] text-[#1B2B4B] font-semibold py-3 rounded-xl transition-colors text-sm">
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-[#1B2B4B] rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1A7A6E] text-white text-xs font-bold px-3 py-1 rounded-full tracking-wide">
                MOST POPULAR
              </div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Pro</p>
              <p className="text-4xl font-bold text-white mb-1">$19</p>
              <p className="text-white/35 text-sm mb-8">per month · cancel anytime</p>
              <ul className="space-y-3 mb-8">
                {["Unlimited podcasts", "Full AI script generation", "Premium AI narration", "Full podcast history", "Custom brand name", "Priority support"].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white/70">
                    <svg className="w-4 h-4 text-[#1A7A6E] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="block w-full text-center bg-[#1A7A6E] hover:bg-[#15695F] text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-[#1B2B4B]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Your next listing deserves<br/>more than photos.
          </h2>
          <p className="text-white/45 text-lg mb-10">
            Join real estate professionals using HomeVoice to create content that buyers actually engage with.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-[#1A7A6E] hover:bg-[#15695F] text-white font-bold px-10 py-4 rounded-xl transition-colors text-base"
          >
            Generate your first report free →
          </Link>
          <p className="text-white/25 text-xs mt-4">10 free reports/month · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E4DC] py-8 px-6 bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#1A7A6E] rounded-md flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <span className="font-semibold text-[#1B2B4B]/50 text-sm">HomeVoice</span>
          </div>
          <p className="text-xs text-[#1B2B4B]/25 text-center">
            © {new Date().getFullYear()} HomeVoice. AI-generated content is not financial or appraisal advice.
          </p>
          <div className="flex gap-5 text-xs text-[#1B2B4B]/35">
            <a href="#" className="hover:text-[#1B2B4B] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[#1B2B4B] transition-colors">Terms</a>
            <a href="mailto:hello@homevoice.app" className="hover:text-[#1B2B4B] transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
