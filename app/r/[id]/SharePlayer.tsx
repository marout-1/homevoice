"use client";

import { useState } from "react";

export default function SharePlayer({ scriptText }: { scriptText: string }) {
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  function handlePlay() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scriptText);
    utterance.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Samantha") || v.name.includes("Google US English") || v.name.includes("Karen")
    );
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setPlaying(true);
    utterance.onend = () => setPlaying(false);
    utterance.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utterance);
  }

  function handleStop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  if (!supported) {
    return (
      <p className="text-sm text-[#1B2B4B]/40">
        Audio playback is not supported in this browser. Read the script below.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={playing ? handleStop : handlePlay}
        className="flex items-center gap-2 bg-[#1A7A6E] hover:bg-[#15695F] text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
      >
        {playing ? "⏹ Stop" : "▶ Play Report"}
      </button>
      {playing && (
        <span className="text-sm text-[#1A7A6E] animate-pulse font-medium">Now playing…</span>
      )}
    </div>
  );
}
