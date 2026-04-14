"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { useRouter } from "next/navigation";

// ─── Address autocomplete (Google Places) ────────────────────────────────────

interface AddressSuggestion {
  placeId: string;
  formatted: string;
  street: string;
  cityStateZip: string;
}

interface UserLocation {
  lat: number;
  lon: number;
}

// Session-level cache — identical queries never re-fetch
const suggestionCache = new Map<string, AddressSuggestion[]>();

// Cached IP location (resolved once per session)
let cachedUserLocation: UserLocation | null = null;
let locationFetchPromise: Promise<UserLocation | null> | null = null;

async function resolveUserLocation(): Promise<UserLocation | null> {
  if (cachedUserLocation) return cachedUserLocation;
  if (locationFetchPromise) return locationFetchPromise;
  locationFetchPromise = (async () => {
    try {
      const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        cachedUserLocation = { lat: data.latitude, lon: data.longitude };
        return cachedUserLocation;
      }
    } catch { /* location bias is best-effort */ }
    return null;
  })();
  return locationFetchPromise;
}

function AddressAutocomplete({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resolve IP location on mount — non-blocking, best-effort
  useEffect(() => {
    resolveUserLocation().then(loc => { if (loc) setUserLocation(loc); });
  }, []);

  const fetchSuggestions = useCallback(async (query: string, location: UserLocation | null) => {
    const q = query.trim();
    latestQueryRef.current = q;

    if (q.length < 2) {
      setSuggestions([]); setShowDropdown(false); setLoading(false); return;
    }

    // Instant cache hit
    if (suggestionCache.has(q)) {
      const cached = suggestionCache.get(q)!;
      setSuggestions(cached);
      setShowDropdown(cached.length > 0);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);

    try {
      const params = new URLSearchParams({ q });
      if (location) {
        params.set("lat", String(location.lat));
        params.set("lon", String(location.lon));
      }
      const res = await fetch(`/api/places?${params}`, { signal });
      if (!res.ok) throw new Error("places error");
      const data = await res.json();
      const results: AddressSuggestion[] = data.results ?? [];

      if (latestQueryRef.current !== q) return;

      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setActiveIndex(-1);
      if (results.length > 0) suggestionCache.set(q, results);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setSuggestions([]); setShowDropdown(false);
      }
    } finally {
      if (latestQueryRef.current === q) setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val, userLocation), 120);
  }

  function handleSelect(suggestion: AddressSuggestion) {
    onChange(suggestion.formatted);
    setSuggestions([]); setShowDropdown(false); setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false); setActiveIndex(-1);
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <span className="absolute left-3.5 text-[#1A7A6E] pointer-events-none text-base">📍</span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Start typing an address… e.g. 1884 Fleming Woods Rd"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          className="w-full border border-[#E8E4DC] rounded-xl pl-9 pr-10 py-3.5 text-[#1B2B4B] placeholder-[#1B2B4B]/30 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent disabled:bg-[#F5F3EF] disabled:text-[#1B2B4B]/40 transition bg-white text-sm"
        />
        {loading && (
          <div className="absolute right-3.5">
            <div className="w-4 h-4 border-2 border-[#1A7A6E] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && value && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onChange(""); setSuggestions([]); setShowDropdown(false); inputRef.current?.focus(); }}
            className="absolute right-3.5 text-[#1B2B4B]/25 hover:text-[#1B2B4B]/60 transition-colors text-lg leading-none"
            aria-label="Clear address"
          >×</button>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 w-full bg-white border border-[#E8E4DC] rounded-xl shadow-xl mt-1.5 overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`px-4 py-3 text-sm cursor-pointer border-b border-[#E8E4DC]/50 last:border-0 transition-colors flex items-start gap-2.5 ${
                i === activeIndex ? "bg-[#EDF4F3]" : "hover:bg-[#F5F3EF]"
              }`}
            >
              <svg className="w-4 h-4 text-[#1A7A6E] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="min-w-0">
                <p className="text-[#1B2B4B] font-semibold truncate">{s.street}</p>
                <p className="text-[#1B2B4B]/45 text-xs mt-0.5">{s.cityStateZip}</p>
              </div>
            </li>
          ))}
          <li className="px-4 py-2 text-xs text-[#1B2B4B]/25 bg-[#F5F3EF] flex items-center justify-between">
            <span>Powered by</span>
            <span>Google Maps</span>
          </li>
        </ul>
      )}
    </div>
  );
}

// ─── First-run onboarding modal ───────────────────────────────────────────────

const ONBOARDING_KEY = "homevoice_onboarding_v1";

function OnboardingModal({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      emoji: "🎙️",
      title: "Welcome to HomeVoice",
      body: "Create professional AI audio reports for any US property in under 90 seconds. Your clients will actually listen.",
      cta: "Show me how →",
    },
    {
      emoji: "🏠",
      title: "Start with an address",
      body: "Type any US property address in the field below. Autocomplete shows nearby addresses first based on your location. Then add your brokerage name — it appears in the outro.",
      cta: "Got it →",
    },
    {
      emoji: "▶️",
      title: "Generate & share",
      body: "Hit Generate and watch us fetch live data, write a script, and narrate it. The whole thing takes about 90 seconds. You get 10 free reports every month.",
      cta: "Let's go →",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  function handleCta() {
    if (isLast) { onDismiss(); return; }
    setStep(s => s + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B2B4B]/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-2xl max-w-sm w-full p-8 text-center relative">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-[#1B2B4B]/25 hover:text-[#1B2B4B]/50 transition-colors text-lg leading-none"
          aria-label="Skip intro"
        >
          ×
        </button>

        <div className="w-16 h-16 bg-[#EDF4F3] rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl">
          {current.emoji}
        </div>

        <h2 className="text-xl font-bold text-[#1B2B4B] mb-3">{current.title}</h2>
        <p className="text-[#1B2B4B]/55 text-sm leading-relaxed mb-7">{current.body}</p>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all ${i === step ? "w-5 h-1.5 bg-[#1A7A6E]" : "w-1.5 h-1.5 bg-[#E8E4DC]"}`}
            />
          ))}
        </div>

        <button
          onClick={handleCta}
          className="w-full bg-[#1A7A6E] hover:bg-[#15695F] text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {current.cta}
        </button>

        {step === 0 && (
          <button
            onClick={onDismiss}
            className="block w-full text-center text-xs text-[#1B2B4B]/30 hover:text-[#1B2B4B]/50 mt-3 transition-colors"
          >
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Custom Content Tab ───────────────────────────────────────────────────────

type CustomStep = "idle" | "reading" | "preview" | "generating" | "done" | "paywalled";

interface IngestResult {
  previewExcerpt: string;
  previewExpanded: string;
  fullTextKey: string;
  wordCount: number;
  sourceLabel: string;
  sourceType: string;
  pageTitle?: string;
}

function CustomContentTab({
  userId,
  brandName,
  isPro,
  onPodcastCreated,
  showToast,
}: {
  userId: string;
  brandName: string;
  isPro: boolean;
  onPodcastCreated: (pod: Podcast) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [step, setStep] = useState<CustomStep>("idle");
  const [url, setUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [podcastId, setPodcastId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const GEN_STEPS = ["Reading your content", "Crafting your script", "Recording audio"];

  async function ingestFile(file: File) {
    setStep("reading");
    setFallbackError(null);
    const form = new FormData();
    form.append("file", file);

    const timer = setTimeout(() => {
      setStep("idle");
      setFallbackError("That file took too long to read. Please try again.");
    }, 20000);

    try {
      const res = await fetch("/api/podcast/ingest-file", { method: "POST", body: form });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok || data.error) {
        setStep("idle");
        setFallbackError(data.error || "Could not read that file.");
        return;
      }
      setIngestResult(data);
      setStep("preview");
    } catch {
      clearTimeout(timer);
      setStep("idle");
      setFallbackError("Network error reading file. Please try again.");
    }
  }

  async function ingestUrl() {
    if (!url.startsWith("https://")) {
      setFallbackError("Please enter a URL starting with https://");
      return;
    }
    setStep("reading");
    setFallbackError(null);
    try {
      const res = await fetch("/api/podcast/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStep("idle");
        setFallbackError(data.error || "Could not fetch that page.");
        setShowPasteFallback(true);
        return;
      }
      setIngestResult(data);
      setStep("preview");
    } catch {
      setStep("idle");
      setFallbackError("Network error. Please try again.");
      setShowPasteFallback(true);
    }
  }

  async function ingestPastedText() {
    if (pasteText.trim().split(/\s+/).length < 50) {
      setFallbackError("Please paste at least 50 words of content.");
      return;
    }
    setStep("reading");
    setFallbackError(null);
    try {
      const res = await fetch("/api/podcast/ingest-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setStep("idle");
        setFallbackError(data.error || "Could not process that text.");
        return;
      }
      setIngestResult(data);
      setStep("preview");
    } catch {
      setStep("idle");
      setFallbackError("Network error. Please try again.");
    }
  }

  async function handleGenerate() {
    if (!ingestResult) return;
    setStep("generating");
    setGenStep(0);

    const t1 = setTimeout(() => setGenStep(1), 5000);
    const t2 = setTimeout(() => setGenStep(2), 12000);

    try {
      const res = await fetch("/api/podcast/generate-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullTextKey: ingestResult.fullTextKey,
          userId,
          brandName,
          sourceLabel: ingestResult.sourceLabel,
          sourceType: ingestResult.sourceType,
        }),
      });
      clearTimeout(t1); clearTimeout(t2);
      const data = await res.json();

      if (data.paywalled) {
        setStep("paywalled");
        return;
      }
      if (!res.ok || data.error) {
        setStep("preview");
        showToast(data.error || "Generation failed. Please try again.", "error");
        return;
      }

      setScriptText(data.script);
      setPodcastId(data.podcastId);
      setGenStep(3);

      if (data.audioBase64) {
        const blob = new Blob(
          [Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))],
          { type: "audio/mpeg" }
        );
        const blobUrl = URL.createObjectURL(blob);
        const el = new Audio(blobUrl);
        el.onended = () => setAudioPlaying(false);
        setAudioEl(el);
        setAudioBase64(data.audioBase64);
      }

      setStep("done");
      onPodcastCreated({
        id: data.podcastId,
        address: ingestResult.sourceLabel,
        city: null as unknown as string,
        state: null as unknown as string,
        zestimate: null,
        script_text: data.script,
        created_at: new Date().toISOString(),
      });
    } catch {
      clearTimeout(t1); clearTimeout(t2);
      setStep("preview");
      showToast("Network error. Please try again.", "error");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) ingestFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) ingestFile(file);
  }

  function handlePlayPause() {
    if (!audioEl) return;
    if (audioPlaying) {
      audioEl.pause();
      setAudioPlaying(false);
    } else {
      audioEl.play().then(() => setAudioPlaying(true)).catch(() => {});
    }
  }

  function handleCopyShare() {
    if (!podcastId) return;
    const shareUrl = `${window.location.origin}/r/${podcastId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  }

  function handleReset() {
    setStep("idle");
    setUrl("");
    setPasteText("");
    setShowPasteFallback(false);
    setFallbackError(null);
    setIngestResult(null);
    setPreviewExpanded(false);
    setScriptText(null);
    setPodcastId(null);
    setAudioBase64(null);
    setAudioEl(null);
    setAudioPlaying(false);
    setGenStep(0);
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-bold text-[#1B2B4B] text-xl">Custom Content Podcast</h2>
        <p className="text-sm text-[#1B2B4B]/50 mt-1">
          Turn any document or article into a branded podcast — upload a file or paste a URL.
        </p>
        {!isPro && (
          <div className="mt-3 bg-[#EDF4F3] border border-[#1A7A6E]/20 rounded-xl px-4 py-3 text-sm text-[#1A7A6E] font-medium">
            🎁 Your first custom podcast is free — no credit card needed.
          </div>
        )}
      </div>

      {/* ── IDLE: input area ── */}
      {step === "idle" && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="bg-white border-2 border-dashed border-[#E8E4DC] hover:border-[#1A7A6E]/40 rounded-2xl p-10 text-center cursor-pointer transition-colors group"
          >
            <div className="w-14 h-14 bg-[#EDF4F3] rounded-xl flex items-center justify-center mx-auto mb-4 text-2xl group-hover:bg-[#1A7A6E]/10 transition-colors">
              📄
            </div>
            <p className="font-semibold text-[#1B2B4B] mb-1">Drop a file or click to browse</p>
            <p className="text-sm text-[#1B2B4B]/40">PDF, DOCX, or TXT · Max 10MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* URL input */}
          <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5">
            <p className="text-sm font-semibold text-[#1B2B4B] mb-3">Or paste a URL</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setFallbackError(null); setShowPasteFallback(false); }}
                placeholder="https://your-newsletter.com/article"
                className="flex-1 border border-[#E8E4DC] rounded-xl px-4 py-2.5 text-sm text-[#1B2B4B] focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent placeholder-[#1B2B4B]/30"
              />
              <button
                onClick={ingestUrl}
                disabled={!url}
                className="bg-[#1A7A6E] hover:bg-[#15695F] disabled:bg-[#1A7A6E]/30 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors whitespace-nowrap"
              >
                Fetch →
              </button>
            </div>
          </div>

          {/* Error + paste fallback */}
          {fallbackError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-sm text-red-700 font-medium">{fallbackError}</p>
              {showPasteFallback && (
                <p className="text-sm text-red-600 mt-1">Paste your content below instead:</p>
              )}
            </div>
          )}

          {showPasteFallback && (
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-5">
              <p className="text-sm font-semibold text-[#1B2B4B] mb-3">Paste your content here →</p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste the article or document text here…"
                rows={7}
                className="w-full border border-[#E8E4DC] rounded-xl px-4 py-3 text-sm text-[#1B2B4B] focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent placeholder-[#1B2B4B]/30 resize-none"
              />
              <button
                onClick={ingestPastedText}
                disabled={pasteText.trim().split(/\s+/).length < 10}
                className="mt-3 bg-[#1A7A6E] hover:bg-[#15695F] disabled:bg-[#1A7A6E]/30 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
              >
                Use this content →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── READING ── */}
      {step === "reading" && (
        <div className="bg-white border border-[#E8E4DC] rounded-2xl p-10 text-center">
          <div className="w-12 h-12 border-4 border-[#1A7A6E] border-t-transparent rounded-full animate-spin mx-auto mb-5" />
          <p className="font-semibold text-[#1B2B4B]">Reading your content…</p>
          <p className="text-sm text-[#1B2B4B]/40 mt-1">This usually takes a few seconds.</p>
        </div>
      )}

      {/* ── PREVIEW ── */}
      {step === "preview" && ingestResult && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E8E4DC] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-[#1A7A6E] font-semibold uppercase tracking-wide mb-1">Content preview</p>
                <p className="font-semibold text-[#1B2B4B]">{ingestResult.sourceLabel}</p>
                <p className="text-xs text-[#1B2B4B]/40 mt-0.5">{ingestResult.wordCount.toLocaleString()} words extracted</p>
              </div>
              <button onClick={handleReset} className="text-sm text-[#1B2B4B]/30 hover:text-[#1B2B4B]/60 transition-colors">
                Try a different file
              </button>
            </div>

            <div className="bg-[#F9F8F6] rounded-xl p-4 text-sm text-[#1B2B4B]/70 leading-relaxed border border-[#E8E4DC]">
              <p>
                {previewExpanded ? ingestResult.previewExpanded : ingestResult.previewExcerpt}
                {!previewExpanded && ingestResult.previewExpanded.length > ingestResult.previewExcerpt.length && (
                  <button
                    onClick={() => setPreviewExpanded(true)}
                    className="ml-2 text-[#1A7A6E] font-medium hover:underline"
                  >
                    Preview more…
                  </button>
                )}
              </p>
            </div>

            <p className="text-xs text-[#1B2B4B]/35 mt-3">
              ✓ Content looks right? We&apos;ll use this to generate your podcast.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            className="w-full bg-[#1A7A6E] hover:bg-[#15695F] text-white font-bold py-4 rounded-2xl transition-colors text-base"
          >
            Looks good — generate podcast →
          </button>
        </div>
      )}

      {/* ── GENERATING ── */}
      {step === "generating" && (
        <div className="bg-white border border-[#E8E4DC] rounded-2xl p-10">
          <p className="font-semibold text-[#1B2B4B] text-center mb-8">Creating your podcast…</p>
          <div className="space-y-4">
            {GEN_STEPS.map((label, i) => {
              const done = genStep > i;
              const active = genStep === i;
              return (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${
                    done ? "bg-[#1A7A6E] text-white" : active ? "bg-[#1A7A6E]/20 text-[#1A7A6E]" : "bg-[#F5F3EF] text-[#1B2B4B]/25"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium transition-colors ${done ? "text-[#1A7A6E]" : active ? "text-[#1B2B4B]" : "text-[#1B2B4B]/30"}`}>
                      {label}
                    </p>
                    {active && (
                      <div className="mt-1.5 h-1 rounded-full bg-[#E8E4DC] overflow-hidden">
                        <div className="h-full bg-[#1A7A6E] rounded-full animate-pulse w-2/3" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {step === "done" && (
        <div className="space-y-4">
          <div className="bg-white border border-[#E8E4DC] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-[#EDF4F3] rounded-xl flex items-center justify-center text-xl">🎙️</div>
              <div>
                <p className="font-bold text-[#1B2B4B]">Your podcast is ready!</p>
                <p className="text-xs text-[#1B2B4B]/40">{ingestResult?.sourceLabel}</p>
              </div>
            </div>

            {/* Audio player */}
            {audioEl && (
              <div className="bg-[#F9F8F6] rounded-xl p-4 flex items-center gap-4 mb-4 border border-[#E8E4DC]">
                <button
                  onClick={handlePlayPause}
                  className="w-10 h-10 bg-[#1A7A6E] rounded-full flex items-center justify-center text-white flex-shrink-0 hover:bg-[#15695F] transition-colors"
                >
                  {audioPlaying ? "⏸" : "▶"}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1B2B4B] truncate">{ingestResult?.sourceLabel}</p>
                  <p className="text-xs text-[#1B2B4B]/40">Custom content podcast · HomeVoice</p>
                </div>
              </div>
            )}

            {/* Share */}
            {podcastId && (
              <button
                onClick={handleCopyShare}
                className="w-full bg-[#1B2B4B] hover:bg-[#1B2B4B]/80 text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
              >
                {shareCopied ? "✓ Link copied!" : "🔗 Copy shareable link"}
              </button>
            )}

            {/* Script preview */}
            {scriptText && (
              <details className="mt-4">
                <summary className="text-sm text-[#1B2B4B]/50 cursor-pointer hover:text-[#1B2B4B]/70 transition-colors">
                  View script
                </summary>
                <div className="mt-3 bg-[#F9F8F6] rounded-xl p-4 text-sm text-[#1B2B4B]/70 leading-relaxed border border-[#E8E4DC] max-h-48 overflow-y-auto">
                  {scriptText}
                </div>
              </details>
            )}
          </div>

          <button
            onClick={handleReset}
            className="w-full border border-[#E8E4DC] hover:border-[#1A7A6E]/40 text-[#1B2B4B]/60 hover:text-[#1B2B4B] font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Create another podcast
          </button>
        </div>
      )}

      {/* ── PAYWALLED ── */}
      {step === "paywalled" && (
        <div className="bg-[#1B2B4B] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4">🔒</div>
          <h3 className="font-bold text-white text-lg mb-2">You&apos;ve used your 1 free custom podcast</h3>
          <p className="text-white/50 text-sm mb-6">Upgrade to Pro for unlimited custom podcasts, plus unlimited address-based reports.</p>
          <a
            href="mailto:hello@homevoice.app?subject=Pro upgrade"
            className="inline-block bg-[#1A7A6E] hover:bg-[#15695F] text-white font-bold px-8 py-3 rounded-xl transition-colors"
          >
            Upgrade to Pro →
          </a>
          <button onClick={handleReset} className="block w-full text-center text-sm text-white/25 hover:text-white/50 mt-4 transition-colors">
            Go back
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Constants & helpers ──────────────────────────────────────────────────────

const FREE_LIMIT = 10;

interface Profile {
  brand_name: string;
  plan: string;
  podcasts_this_month: number;
}

interface Podcast {
  id: string;
  address: string;
  city: string;
  state: string;
  zestimate: number | null;
  script_text: string | null;
  created_at: string;
  source_type?: string;
  source_label?: string;
}

interface Props {
  user: { id: string; email: string; is_admin: boolean };
  profile: Profile;
  podcasts: Podcast[];
}

const STEPS = [
  "Fetching property data",
  "Pulling market trends",
  "Writing podcast script",
  "Generating audio",
];

const SECTION_LABELS: Record<string, string> = {
  hook: "🎙️ Hook",
  overview: "🏠 Property Overview",
  comps: "📊 Comparable Sales",
  trends: "📈 Market Trends",
  outlook: "🔭 Outlook",
  outro: "👋 Outro",
};

function formatCurrency(n: number | null): string {
  if (!n) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient({ user, profile: initialProfile, podcasts: initialPodcasts }: Props) {
  const [activeTab, setActiveTab] = useState<"generate" | "custom" | "history" | "profile">("generate");
  const [profile, setProfile] = useState(initialProfile);
  const [podcasts, setPodcasts] = useState(initialPodcasts);

  // Generate form state
  const [address, setAddress] = useState("");
  const [brandName, setBrandName] = useState(profile.brand_name || "HomeVoice");
  const [agentContext, setAgentContext] = useState("");
  const [podcastTone, setPodcastTone] = useState("friendly");
  const [podcastFormat, setPodcastFormat] = useState("market-compass");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioMode, setAudioMode] = useState<"real" | "tts" | null>(null); // "real" = base64 MP3, "tts" = browser
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(-1);
  const [result, setResult] = useState<null | Record<string, unknown>>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [savedPodcastId, setSavedPodcastId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  // Address pre-validation
  const [addressWarning, setAddressWarning] = useState<string | null>(null);

  // Profile form state
  const [newBrandName, setNewBrandName] = useState(profile.brand_name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Onboarding modal
  const [showOnboarding, setShowOnboarding] = useState(false);

  // History expanded item + pagination
  const [expandedPodcastId, setExpandedPodcastId] = useState<string | null>(null);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  const supabase = createClient();
  const router = useRouter();

  const usedThisMonth = profile.podcasts_this_month || 0;
  const isPro = profile.plan === "pro";
  const atLimit = !isPro && usedThisMonth >= FREE_LIMIT;

  // Show onboarding on first visit
  useEffect(() => {
    try {
      const seen = localStorage.getItem(ONBOARDING_KEY);
      if (!seen) setShowOnboarding(true);
    } catch { /* ignore */ }
  }, []);

  function dismissOnboarding() {
    setShowOnboarding(false);
    try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch { /* ignore */ }
  }

  async function simulateSteps() {
    for (let i = 0; i < STEPS.length; i++) {
      setCurrentStep(i);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  function validateAddress(addr: string): string | null {
    const trimmed = addr.trim();
    if (!trimmed) return "Please enter a property address.";
    if (!/^\d+/.test(trimmed)) return "Address must start with a street number (e.g. 123 Main St, Charleston, SC).";
    const words = trimmed.split(/\s+/);
    if (words.length < 4) return "Please enter a full address including street, city, and state.";
    if (!trimmed.includes(",")) return "Please include the city and state (e.g. 123 Main St, Charleston, SC).";
    if (trimmed.length < 15) return "Please enter a complete address.";
    return null;
  }

  // Warn if address looks like it won't return live data
  function checkAddressForWarning(addr: string) {
    const trimmed = addr.trim();
    // PO boxes, rural routes, very short inputs
    if (/^(p\.?o\.?\s*box|po\s+box|rr\s+\d|route\s+\d)/i.test(trimmed)) {
      setAddressWarning("PO Boxes and rural routes may not have live property data — we may use sample data for this report.");
    } else {
      setAddressWarning(null);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (atLimit) return;

    const validationError = validateAddress(address);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setAudioUrl(null);
    setCurrentStep(0);

    // Progress animation runs in parallel — steps 0-2 animate during the generate call,
    // step 3 ("Generating audio") animates during the separate /api/tts call.
    const advanceToStep = (step: number) => setCurrentStep(step);

    try {
      // ── Phase 1: script generation (≤10s) ──────────────────────────────────
      advanceToStep(0);
      // Advance steps 1 and 2 on a timer so they feel real
      const stepTimer1 = setTimeout(() => advanceToStep(1), 1500);
      const stepTimer2 = setTimeout(() => advanceToStep(2), 3000);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), brandName, agentContext, podcastTone, podcastFormat }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `Server error (${res.status}). Please try again.`);
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (!data.success || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Script is ready — show results immediately so user isn't staring at a blank screen
      setResult(data);
      const scriptFullText: string = data.script?.fullText ?? "";

      // Save to Supabase
      const prop = data.property;
      await supabase.from("podcasts").insert({
        user_id: user.id,
        address: prop.address,
        city: prop.city,
        state: prop.state,
        zestimate: prop.zestimate,
        last_sold_price: prop.lastSoldPrice,
        script_text: scriptFullText,
        audio_provider: "pending",
        data_source: prop.dataSource,
        brand_name: brandName,
      });

      await supabase
        .from("profiles")
        .update({ podcasts_this_month: usedThisMonth + 1 })
        .eq("id", user.id);
      setProfile((p) => ({ ...p, podcasts_this_month: usedThisMonth + 1 }));

      const { data: newPodcasts } = await supabase
        .from("podcasts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (newPodcasts) {
        setPodcasts(newPodcasts);
        if (newPodcasts[0]) setSavedPodcastId(newPodcasts[0].id);
      }

      // ── Phase 2: audio generation (separate call, no timeout risk) ─────────
      advanceToStep(3);

      try {
        const ttsRes = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: scriptFullText }),
        });

        if (ttsRes.ok) {
          const ttsData = await ttsRes.json();
          if (ttsData.available && ttsData.base64) {
            // Real MP3 audio returned
            const blob = new Blob(
              [Uint8Array.from(atob(ttsData.base64), c => c.charCodeAt(0))],
              { type: "audio/mpeg" }
            );
            const url = URL.createObjectURL(blob);
            const el = new Audio(url);
            el.onended = () => setAudioPlaying(false);
            el.onerror = () => setAudioPlaying(false);
            setAudioElement(el);
            setAudioUrl(url);
            setAudioMode("real");
            setAudioReady(true);
            setCurrentStep(STEPS.length);
            setLoading(false);
            return;
          }
        }
      } catch (ttsErr) {
        console.warn("[audio] TTS call failed, falling back to browser TTS:", ttsErr);
      }

      // Fallback: browser TTS
      if (scriptFullText && typeof window !== "undefined" && window.speechSynthesis) {
        setScriptText(scriptFullText);
        setAudioMode("tts");
        setAudioReady(true);
      }

      setCurrentStep(STEPS.length);
    } catch (err) {
      console.error("[generate] unexpected error:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `homevoice_${address.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.mp3`;
    a.click();
  }

  function handlePlayTTS() {
    if (audioMode === "real" && audioElement) {
      // Play real MP3
      audioElement.currentTime = 0;
      audioElement.play().then(() => setAudioPlaying(true)).catch(() => setAudioPlaying(false));
      return;
    }
    // Browser TTS fallback
    if (!scriptText || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scriptText);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google US English") || v.name.includes("Karen"));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setAudioPlaying(true);
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function handleStopTTS() {
    if (audioMode === "real" && audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioPlaying(false);
      return;
    }
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setAudioPlaying(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const { error: saveErr } = await supabase.from("profiles").update({ brand_name: newBrandName }).eq("id", user.id);
    setProfile((p) => ({ ...p, brand_name: newBrandName }));
    setBrandName(newBrandName);
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
    if (saveErr) {
      showToast("Failed to save brand name. Please try again.", "error");
    } else {
      showToast("Brand name saved!");
    }
  }

  async function handleLoadMoreHistory() {
    setLoadingMoreHistory(true);
    const newLimit = historyLimit + 10;
    const { data: morePodcasts } = await supabase
      .from("podcasts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(newLimit);
    if (morePodcasts) setPodcasts(morePodcasts);
    setHistoryLimit(newLimit);
    setLoadingMoreHistory(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const script = result ? (result as Record<string, unknown>).script as { sections: Record<string, string>; fullText: string } | undefined : undefined;
  const property = result ? (result as Record<string, unknown>).property as Record<string, unknown> | undefined : undefined;
  const audio = result ? (result as Record<string, unknown>).audio as { provider: string; available: boolean } | undefined : undefined;

  return (
    <>
      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-3 ${
          toast.type === "error"
            ? "bg-red-600 text-white"
            : "bg-[#1B2B4B] text-white"
        }`}>
          {toast.type === "success" ? (
            <svg className="w-4 h-4 text-[#4ECAB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 5a7 7 0 100 14 7 7 0 000-14z" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Onboarding modal */}
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}

      {/* ── Top nav (fixed to viewport) ──────────────────────────────────── */}
      <nav className="bg-white border-b border-[#E8E4DC] px-6 py-4 fixed top-0 left-0 right-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1A7A6E] rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <span className="font-bold text-[#1B2B4B]">HomeVoice</span>
          </Link>
          <div className="flex items-center gap-4">
            {/* Usage pill */}
            <div className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${
              atLimit
                ? "bg-red-50 text-red-600 border-red-200"
                : isPro
                ? "bg-[#EDF4F3] text-[#1A7A6E] border-[#1A7A6E]/20"
                : "bg-[#F5F3EF] text-[#1B2B4B]/60 border-[#E8E4DC]"
            }`}>
              {isPro ? "Pro · Unlimited" : `${usedThisMonth} / ${FREE_LIMIT} this month`}
            </div>
            <span className="text-sm text-[#1B2B4B]/40 hidden sm:block">{user.email}</span>
            {/* Admin toggle — only shown to admin users */}
            {user.is_admin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#1B2B4B] text-white hover:bg-[#1B2B4B]/80 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
              </Link>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm text-[#1B2B4B]/40 hover:text-[#1B2B4B] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* Body — offset for fixed nav (nav is ~65px tall) */}
      <div className="min-h-screen bg-[#FAFAF8] pt-[65px]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── Tab nav ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-[#F5F3EF] border border-[#E8E4DC] p-1 rounded-xl w-fit mb-8">
          {([
            { id: "generate", label: "🎙️ Generate" },
            { id: "custom",   label: "📄 Custom Content" },
            { id: "history",  label: "📚 History" },
            { id: "profile",  label: "⚙️ Profile" },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#1B2B4B] shadow-sm border border-[#E8E4DC]"
                  : "text-[#1B2B4B]/45 hover:text-[#1B2B4B]/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Generate tab ──────────────────────────────────────────────────── */}
        {activeTab === "generate" && (
          <div className="space-y-5">
            {/* Usage limit banner */}
            {atLimit && !isPro && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-semibold text-amber-800">You&apos;ve used all {FREE_LIMIT} free podcasts this month</p>
                  <p className="text-amber-700 text-sm mt-1">
                    Upgrade to Pro for unlimited podcasts — or wait until next month for your free credits to reset.
                  </p>
                  <Link href="/signup" className="inline-block mt-3 bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                    Upgrade to Pro →
                  </Link>
                </div>
              </div>
            )}

            {/* Generate form */}
            {!result && (
              <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
                <h2 className="font-bold text-[#1B2B4B] text-lg mb-1">Generate a podcast</h2>
                <p className="text-[#1B2B4B]/45 text-sm mb-5">Enter any US property address to create a narrated market report.</p>

                <form onSubmit={handleGenerate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#1B2B4B] mb-1.5">
                      Property Address
                    </label>
                    <AddressAutocomplete
                      value={address}
                      onChange={(val) => {
                        setAddress(val);
                        setError(null);
                        checkAddressForWarning(val);
                      }}
                      disabled={loading || atLimit}
                    />
                    {addressWarning && (
                      <p className="mt-2 text-xs text-amber-600 flex items-start gap-1.5">
                        <span>⚠️</span>
                        <span>{addressWarning}</span>
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-[#1B2B4B]/30">
                      Try: <span className="italic">1884 Fleming Woods Rd, Charleston, SC 29412</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1B2B4B] mb-0.5">
                      Brand Name
                    </label>
                    <p className="text-xs text-[#1B2B4B]/40 mb-1.5">
                      Spoken at the end of the podcast — e.g. &ldquo;Brought to you by Keller Williams Austin Team&rdquo;
                    </p>
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="e.g. Keller Williams Austin Team"
                      disabled={loading}
                      className="w-full border border-[#E8E4DC] rounded-xl px-4 py-3 text-[#1B2B4B] placeholder-[#1B2B4B]/30 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent disabled:bg-[#F5F3EF] transition"
                    />
                  </div>
                  {/* Personalization toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(v => !v)}
                      className="flex items-center gap-1.5 text-sm text-[#1A7A6E] font-medium hover:text-[#15695F] transition-colors"
                    >
                      <svg className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Personalize this podcast
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4 border border-[#E8E4DC] rounded-xl p-4 bg-[#FAFAF8]">

                        {/* Podcast format */}
                        <div>
                          <label className="block text-sm font-semibold text-[#1B2B4B] mb-2">Podcast Format</label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                              { id: "market-compass", label: "🧭 Market Compass", desc: "Expert market overview" },
                              { id: "buyers-brief", label: "🏠 Buyer's Brief", desc: "For buyers touring the home" },
                              { id: "sellers-advantage", label: "📈 Seller's Advantage", desc: "For sellers & listings" },
                            ].map(f => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setPodcastFormat(f.id)}
                                className={`text-left p-3 rounded-xl border transition-all ${
                                  podcastFormat === f.id
                                    ? "border-[#1A7A6E] bg-[#EDF4F3] text-[#1A7A6E]"
                                    : "border-[#E8E4DC] bg-white text-[#1B2B4B]/60 hover:border-[#1A7A6E]/40"
                                }`}
                              >
                                <p className="font-semibold text-xs">{f.label}</p>
                                <p className="text-xs mt-0.5 opacity-70">{f.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Tone */}
                        <div>
                          <label className="block text-sm font-semibold text-[#1B2B4B] mb-2">Voice Tone</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { id: "friendly", label: "😊 Friendly", desc: "Warm & approachable" },
                              { id: "expert", label: "📊 Expert", desc: "Data-driven & precise" },
                              { id: "neighborhood", label: "🏘️ Local", desc: "Community storyteller" },
                            ].map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setPodcastTone(t.id)}
                                className={`text-left p-3 rounded-xl border transition-all ${
                                  podcastTone === t.id
                                    ? "border-[#1A7A6E] bg-[#EDF4F3] text-[#1A7A6E]"
                                    : "border-[#E8E4DC] bg-white text-[#1B2B4B]/60 hover:border-[#1A7A6E]/40"
                                }`}
                              >
                                <p className="font-semibold text-xs">{t.label}</p>
                                <p className="text-xs mt-0.5 opacity-70">{t.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Agent personal context */}
                        <div>
                          <label className="block text-sm font-semibold text-[#1B2B4B] mb-1">
                            Your Personal Touch <span className="text-[#1B2B4B]/35 font-normal">(optional)</span>
                          </label>
                          <p className="text-xs text-[#1B2B4B]/40 mb-2">
                            Anything you want woven into the script — a local insight, what you love about this neighborhood, a note for buyers or sellers, your catchphrase.
                          </p>
                          <textarea
                            value={agentContext}
                            onChange={e => setAgentContext(e.target.value)}
                            placeholder={`e.g. "I've sold 12 homes in this zip code. This street floods less than the others — it's the hidden gem of the neighborhood." or "Mention that the schools here are top-rated and walkable."`}
                            rows={3}
                            maxLength={400}
                            className="w-full border border-[#E8E4DC] rounded-xl px-4 py-3 text-sm text-[#1B2B4B] placeholder-[#1B2B4B]/25 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent resize-none"
                          />
                          <p className="text-xs text-[#1B2B4B]/25 text-right mt-1">{agentContext.length}/400</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || atLimit || !address.trim()}
                    className="w-full bg-[#1A7A6E] hover:bg-[#15695F] disabled:bg-[#1A7A6E]/30 text-white font-bold rounded-xl px-6 py-3.5 transition-colors text-base"
                  >
                    {loading ? "Generating…" : atLimit ? "Monthly limit reached" : "🎙️ Generate Podcast"}
                  </button>
                </form>
              </div>
            )}

            {/* Progress */}
            {loading && (
              <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-8">
                <h3 className="font-bold text-[#1B2B4B] text-center mb-2">Building your podcast…</h3>
                <p className="text-center text-xs text-[#1B2B4B]/35 mb-6">
                  {currentStep >= 0 && currentStep < STEPS.length ? STEPS[currentStep] : "Almost there…"}
                </p>
                {/* Real progress bar */}
                <div className="mb-7">
                  <div className="flex justify-between text-xs text-[#1B2B4B]/35 mb-1.5">
                    <span>Progress</span>
                    <span>{Math.round(Math.min((currentStep / STEPS.length) * 100, 95))}%</span>
                  </div>
                  <div className="h-2 bg-[#F5F3EF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1A7A6E] rounded-full transition-all duration-700 ease-in-out"
                      style={{ width: `${Math.min((currentStep / STEPS.length) * 100, 95)}%` }}
                    />
                  </div>
                </div>
                {/* Step list */}
                <div className="space-y-3">
                  {STEPS.map((step, i) => {
                    const done = i < currentStep;
                    const active = i === currentStep;
                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${done ? "bg-[#1A7A6E]" : active ? "bg-[#1B2B4B]" : "bg-[#F5F3EF]"}`}>
                          {done ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : active ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#E8E4DC]" />
                          )}
                        </div>
                        <span className={`text-sm font-medium transition-all ${done ? "text-[#1A7A6E]" : active ? "text-[#1B2B4B]" : "text-[#1B2B4B]/25"}`}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-center text-xs text-[#1B2B4B]/25 mt-6">About 60–90 seconds ☕</p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-700 mb-1">Something went wrong</p>
                    <p className="text-red-600 text-sm">{error}</p>
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={(e) => { setError(null); handleGenerate(e as unknown as React.FormEvent); }}
                        disabled={!address.trim()}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                      >
                        🔄 Retry
                      </button>
                      <button
                        onClick={() => { setError(null); setResult(null); }}
                        className="text-sm text-red-500 hover:text-red-700 transition-colors"
                      >
                        Edit address
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {result && property && (
              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <h3 className="font-bold text-[#1B2B4B]">Your podcast is ready 🎉</h3>
                  <div className="flex items-center gap-3">
                    {/* Share link */}
                    {savedPodcastId && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/r/${savedPodcastId}`;
                          navigator.clipboard.writeText(url).then(() => {
                            setShareCopied(true);
                            setTimeout(() => setShareCopied(false), 2000);
                          });
                        }}
                        className="flex items-center gap-1.5 border border-[#E8E4DC] text-[#1B2B4B] hover:bg-[#F5F3EF] text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                      >
                        {shareCopied ? (
                          <><span className="text-[#1A7A6E]">✓</span> Link copied!</>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Share</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        handleStopTTS();
                        if (audioUrl) URL.revokeObjectURL(audioUrl);
                        setResult(null); setAudioUrl(null); setAudioReady(false);
                        setScriptText(null); setAudioPlaying(false); setAudioMode(null);
                        setAudioElement(null); setAddress(""); setError(null);
                        setCurrentStep(-1); setExpandedSection(null); setSavedPodcastId(null);
                      }}
                      className="text-sm text-[#1A7A6E] hover:text-[#15695F] font-semibold transition-colors"
                    >
                      + Generate another
                    </button>
                  </div>
                </div>

                {/* Demo data warning */}
                {String(property.dataSource || "").toLowerCase().includes("demo") && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">Sample data used</p>
                      <p className="text-amber-700 text-sm mt-0.5">No live property data was found for this address — the podcast uses sample figures. Do not share with clients as real data. Try a different address or contact support to enable live data.</p>
                    </div>
                  </div>
                )}

                {/* Property card */}
                <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
                  {/* Photo + Map row */}
                  {((property.imageUrls as string[] | undefined)?.length || (property.latitude && property.longitude)) ? (
                    <div className="grid grid-cols-2 h-52 sm:h-64">
                      {/* Property photo */}
                      {(property.imageUrls as string[] | undefined)?.[0] ? (
                        <div className="relative overflow-hidden border-r border-[#E8E4DC]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(property.imageUrls as string[])[0].replace("cc_ft_192", "cc_ft_960")}
                            alt={String(property.address)}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          {(property.imageUrls as string[]).length > 1 && (
                            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                              +{(property.imageUrls as string[]).length - 1} photos
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-[#F5F3EF] flex items-center justify-center border-r border-[#E8E4DC]">
                          <span className="text-4xl opacity-20">🏠</span>
                        </div>
                      )}
                      {/* Map */}
                      {property.latitude && property.longitude ? (
                        <div className="relative overflow-hidden">
                          <iframe
                            title="Property location"
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(property.longitude) - 0.005}%2C${Number(property.latitude) - 0.004}%2C${Number(property.longitude) + 0.005}%2C${Number(property.latitude) + 0.004}&layer=mapnik&marker=${property.latitude}%2C${property.longitude}`}
                            className="w-full h-full border-0"
                            loading="lazy"
                          />
                          <div className="absolute bottom-2 left-2">
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${property.latitude}&mlon=${property.longitude}#map=16/${property.latitude}/${property.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-white/90 text-[#1B2B4B] text-xs px-2 py-0.5 rounded-full border border-[#E8E4DC] hover:bg-white transition-colors"
                            >
                              View larger map ↗
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-[#F5F3EF] flex items-center justify-center">
                          <span className="text-4xl opacity-20">🗺️</span>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Address + stats */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h4 className="font-bold text-[#1B2B4B]">{String(property.address)}</h4>
                      {/* Market temperature badge */}
                      {(() => {
                        const temp = (result as Record<string, unknown>)?.marketTemperature as string | undefined;
                        if (!temp) return null;
                        const colors: Record<string, string> = {
                          hot: "bg-red-50 text-red-600 border-red-200",
                          warm: "bg-amber-50 text-amber-600 border-amber-200",
                          cool: "bg-blue-50 text-blue-600 border-blue-200",
                          cold: "bg-slate-50 text-slate-500 border-slate-200",
                        };
                        const icons: Record<string, string> = { hot: "🔥", warm: "☀️", cool: "❄️", cold: "🌨️" };
                        return (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${colors[temp] ?? colors.warm}`}>
                            {icons[temp] ?? "📊"} {temp.charAt(0).toUpperCase() + temp.slice(1)} market
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-[#1B2B4B]/45 text-sm mb-4">{String(property.city)}, {String(property.state)}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Est. Value", value: formatCurrency((property.zestimate as number) ?? null) },
                        { label: "Last Sold", value: formatCurrency((property.lastSoldPrice as number) ?? null) },
                        { label: "Beds / Baths", value: `${property.beds ?? "—"} / ${property.baths ?? "—"}` },
                        { label: "Sq Ft", value: property.sqft ? Number(property.sqft).toLocaleString() : "—" },
                      ].map((s) => (
                        <div key={s.label} className="bg-[#F5F3EF] rounded-xl p-3">
                          <p className="text-xs text-[#1B2B4B]/40 mb-1">{s.label}</p>
                          <p className="font-bold text-[#1B2B4B] text-sm">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audio player */}
                <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
                  <h4 className="font-bold text-[#1B2B4B] mb-4 flex items-center gap-2">
                    🎧 Your Podcast
                    {audioMode === "real" && audio?.provider && audio.provider !== "none" ? (
                      <span className="text-xs bg-[#EDF4F3] text-[#1A7A6E] border border-[#1A7A6E]/20 px-2 py-0.5 rounded-full font-semibold ml-auto">
                        AI Voice · {audio.provider}
                      </span>
                    ) : audioMode === "tts" ? (
                      <span className="text-xs text-[#1B2B4B]/25 font-normal ml-auto">Browser voice</span>
                    ) : null}
                  </h4>
                  {audioReady ? (
                    <>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <button
                          onClick={audioPlaying ? handleStopTTS : handlePlayTTS}
                          className="flex items-center gap-2 bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                        >
                          {audioPlaying ? "⏹ Stop" : "▶ Play Podcast"}
                        </button>
                        {audioPlaying && (
                          <span className="text-sm text-[#1A7A6E] animate-pulse font-medium">Now playing…</span>
                        )}
                        {/* Download MP3 only available for real audio */}
                        {audioMode === "real" && audioUrl && (
                          <button
                            onClick={handleDownload}
                            className="flex items-center gap-1.5 border border-[#E8E4DC] text-[#1B2B4B] hover:bg-[#F5F3EF] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download MP3
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-[#1B2B4B]/30">
                        💡 Tip: Play this at your next open house or attach it to your listing email.
                      </p>
                    </>
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
                      <p className="font-medium mb-1">Audio unavailable</p>
                      <p className="text-xs text-amber-600">Your browser does not support text-to-speech. Your script is ready below.</p>
                    </div>
                  )}
                </div>

                {/* Script accordion */}
                {script && (
                  <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#E8E4DC]">
                      <h4 className="font-bold text-[#1B2B4B]">📄 Podcast Script</h4>
                    </div>
                    {Object.entries(script.sections).map(([key, text]) => (
                      <div key={key} className="border-b border-[#E8E4DC] last:border-0">
                        <button
                          onClick={() => setExpandedSection(expandedSection === key ? null : key)}
                          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F5F3EF] transition-colors"
                        >
                          <span className="font-semibold text-sm text-[#1B2B4B]">{SECTION_LABELS[key] || key}</span>
                          <svg className={`w-4 h-4 text-[#1B2B4B]/30 transition-transform ${expandedSection === key ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {expandedSection === key && (
                          <div className="px-6 pb-5">
                            <p className="text-sm text-[#1B2B4B]/60 leading-relaxed whitespace-pre-wrap">{text}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Success upsell (only for free users near/at limit) */}
                {!isPro && usedThisMonth >= Math.floor(FREE_LIMIT * 0.7) && (
                  <div className="bg-[#1B2B4B] rounded-2xl p-6 text-center">
                    <p className="font-bold text-white mb-1">Loving HomeVoice?</p>
                    <p className="text-white/50 text-sm mb-4">
                      You&apos;ve used {usedThisMonth} of {FREE_LIMIT} free podcasts this month. Upgrade to Pro for unlimited.
                    </p>
                    <Link href="/signup" className="inline-block bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors">
                      Upgrade to Pro — $19/mo →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Custom Content tab ────────────────────────────────────────────── */}
        {activeTab === "custom" && (
          <CustomContentTab
            userId={user.id}
            brandName={brandName}
            isPro={isPro}
            onPodcastCreated={(pod) => {
              setPodcasts((prev) => [pod, ...prev]);
              showToast("Podcast created! Check your History tab.");
            }}
            showToast={showToast}
          />
        )}

        {/* ── History tab ───────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-[#1B2B4B] text-lg">Podcast History</h2>
              {podcasts.length > 0 && (
                <span className="text-xs text-[#1B2B4B]/35 bg-[#F5F3EF] px-3 py-1.5 rounded-full border border-[#E8E4DC]">
                  {podcasts.length} podcast{podcasts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {podcasts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-[#EDF4F3] rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">🎙️</div>
                <p className="font-semibold text-[#1B2B4B] mb-2">No podcasts yet</p>
                <p className="text-sm text-[#1B2B4B]/40 mb-5">Your generated podcasts will appear here. Each one is saved automatically.</p>
                <button
                  onClick={() => setActiveTab("generate")}
                  className="bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  Generate your first podcast →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {podcasts.slice(0, historyLimit).map((pod) => {
                  const isExpanded = expandedPodcastId === pod.id;
                  return (
                    <div key={pod.id} className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedPodcastId(isExpanded ? null : pod.id)}
                        className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-[#FAFAF8] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#1B2B4B] truncate">{pod.address}</p>
                          {pod.source_type && pod.source_type !== "address" && pod.source_label && (
                            <p className="text-xs text-[#1A7A6E] font-medium mt-0.5 truncate">
                              📄 {pod.source_label}
                            </p>
                          )}
                          <p className="text-sm text-[#1B2B4B]/40 mt-0.5">
                            {pod.city && pod.state ? `${pod.city}, ${pod.state} · ` : ""}
                            {pod.zestimate ? `Est. ${formatCurrency(pod.zestimate)} · ` : ""}
                            {new Date(pod.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {pod.source_type && pod.source_type !== "address" && (
                            <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2 py-1 rounded-lg font-medium">
                              Custom
                            </span>
                          )}
                          <span className="text-xs text-[#1A7A6E] bg-[#EDF4F3] border border-[#1A7A6E]/20 px-2 py-1 rounded-lg font-medium">
                            Completed
                          </span>
                          <svg
                            className={`w-4 h-4 text-[#1B2B4B]/30 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#E8E4DC] px-5 pb-5 pt-4 space-y-4">
                          {/* Replay from history */}
                          {pod.script_text && (
                            <div>
                              <h4 className="text-xs font-semibold text-[#1B2B4B]/50 uppercase tracking-wide mb-3">Script</h4>
                              <div className="bg-[#FAFAF8] rounded-xl border border-[#E8E4DC] p-4">
                                <p className="text-sm text-[#1B2B4B]/60 leading-relaxed whitespace-pre-wrap line-clamp-6">{pod.script_text}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (!pod.script_text || typeof window === "undefined") return;
                                window.speechSynthesis.cancel();
                                const utterance = new SpeechSynthesisUtterance(pod.script_text);
                                utterance.rate = 0.95;
                                const voices = window.speechSynthesis.getVoices();
                                const preferred = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google US English") || v.name.includes("Karen"));
                                if (preferred) utterance.voice = preferred;
                                window.speechSynthesis.speak(utterance);
                              }}
                              className="flex items-center gap-1.5 bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                            >
                              ▶ Replay
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddress(pod.address);
                                setActiveTab("generate");
                              }}
                              className="flex items-center gap-1.5 border border-[#E8E4DC] text-[#1B2B4B]/60 hover:bg-[#F5F3EF] text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                            >
                              🔄 Regenerate
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Load more */}
                {podcasts.length >= historyLimit && (
                  <button
                    onClick={handleLoadMoreHistory}
                    disabled={loadingMoreHistory}
                    className="w-full py-3 text-sm font-medium text-[#1A7A6E] hover:text-[#15695F] border border-dashed border-[#1A7A6E]/30 hover:border-[#1A7A6E]/60 rounded-2xl transition-all disabled:opacity-50"
                  >
                    {loadingMoreHistory ? "Loading…" : "Load more podcasts"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Profile tab ───────────────────────────────────────────────────── */}
        {activeTab === "profile" && (
          <div className="max-w-md space-y-5">
            <h2 className="font-bold text-[#1B2B4B] text-lg">Profile & Settings</h2>

            <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
              <h3 className="font-semibold text-[#1B2B4B] mb-4">Account</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#1B2B4B]/40 mb-1">Email</p>
                  <p className="text-sm text-[#1B2B4B] font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-xs text-[#1B2B4B]/40 mb-1">Plan</p>
                  <p className="text-sm text-[#1B2B4B] font-medium capitalize">{profile.plan}</p>
                </div>
                <div>
                  <p className="text-xs text-[#1B2B4B]/40 mb-1">Podcasts this month</p>
                  <p className="text-sm text-[#1B2B4B] font-medium">
                    {profile.podcasts_this_month} / {isPro ? "∞" : FREE_LIMIT}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-[#E8E4DC] shadow-sm p-6">
              <h3 className="font-semibold text-[#1B2B4B] mb-1">Brand Name</h3>
              <p className="text-sm text-[#1B2B4B]/45 mb-4">
                This name is spoken at the end of every podcast you generate — e.g. &ldquo;Brought to you by <em>{newBrandName || "Your Brand"}</em>&rdquo;
              </p>
              <form onSubmit={handleSaveProfile} className="space-y-3">
                <input
                  type="text"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Keller Williams Austin Team"
                  className="w-full border border-[#E8E4DC] rounded-xl px-4 py-3 text-sm text-[#1B2B4B] focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent placeholder-[#1B2B4B]/30"
                />
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="bg-[#1A7A6E] hover:bg-[#15695F] disabled:bg-[#1A7A6E]/30 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
                >
                  {profileSaved ? "✓ Saved" : savingProfile ? "Saving…" : "Save brand name"}
                </button>
              </form>
            </div>

            {!isPro && (
              <div className="bg-[#1B2B4B] rounded-2xl p-6">
                <h3 className="font-bold text-white mb-1">Upgrade to Pro</h3>
                <p className="text-white/50 text-sm mb-1">Unlimited podcasts for $19/month.</p>
                <ul className="text-white/40 text-sm mb-5 space-y-1">
                  <li>✓ Unlimited podcasts</li>
                  <li>✓ Full podcast history</li>
                  <li>✓ Priority support</li>
                </ul>
                <a
                  href="mailto:hello@homevoice.app?subject=Pro upgrade"
                  className="inline-block bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                >
                  Upgrade to Pro →
                </a>
              </div>
            )}

            <button
              onClick={handleSignOut}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
