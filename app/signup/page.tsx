"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Fire welcome email non-blocking
    if (data.user) {
      fetch("/api/welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id, email }),
      }).catch(() => {/* best-effort */});
    }

    // Go straight to dashboard — no email confirmation wall
    router.push("/dashboard");
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#1A7A6E] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9,22 9,12 15,12 15,22" fill="none" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
            <span className="font-bold text-[#1B2B4B] text-xl tracking-tight">HomeVoice</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#1B2B4B]">Create your account</h1>
          <p className="text-[#1B2B4B]/50 text-sm mt-1">10 free podcasts every month — no credit card needed</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E4DC] p-6">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-[#E8E4DC] hover:border-[#1A7A6E]/30 hover:bg-[#F5F3EF] text-[#1B2B4B]/70 font-medium py-3 rounded-xl transition-colors text-sm mb-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E8E4DC]"></div>
            </div>
            <div className="relative flex justify-center text-xs text-[#1B2B4B]/30 bg-white px-3">or</div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4" noValidate>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-[#1B2B4B]/70 mb-1.5">Email</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                aria-describedby={error ? "signup-error" : undefined}
                className="w-full border border-[#E8E4DC] rounded-xl px-4 py-3 text-sm text-[#1B2B4B] placeholder-[#1B2B4B]/30 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-[#1B2B4B]/70 mb-1.5">Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Min. 6 characters"
                className="w-full border border-[#E8E4DC] rounded-xl px-4 py-3 text-sm text-[#1B2B4B] placeholder-[#1B2B4B]/30 focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:border-transparent transition-shadow"
              />
            </div>

            {error && (
              <div id="signup-error" role="alert" className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A7A6E] hover:bg-[#15695F] disabled:bg-[#1A7A6E]/50 text-white font-semibold py-3 rounded-xl transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-[#1A7A6E] focus:ring-offset-2"
            >
              {loading ? "Creating account…" : "Create free account"}
            </button>
          </form>

          <p className="text-xs text-[#1B2B4B]/30 text-center mt-4">
            By signing up you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>

        <p className="text-center text-sm text-[#1B2B4B]/45 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1A7A6E] hover:text-[#15695F] font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
