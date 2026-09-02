"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) setError(error.message);
    } catch (err: any) {
      setError(err.message || "Failed to initiate Google OAuth");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage("📩 Magic login link sent to your email! Check your inbox.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-[#F6F7F5] dark:bg-[#101720]">
      <div className="card-surface p-8 md:p-10 rounded-2xl border shadow-xl max-w-md w-full space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#14213D] text-white text-xs font-mono rounded-full uppercase">
            <span className="w-2 h-2 rounded-full bg-[#D62828] animate-pulse" />
            <span>Secure Authentication</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-primary-var">
            Welcome to BloodLink
          </h1>
          <p className="text-xs text-secondary-var">
            Sign in to access emergency dispatches, donor tracking, and blood bank inventory.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#D62828]/10 text-[#D62828] border border-[#D62828]/30 rounded-lg text-xs font-mono font-bold">
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div className="p-3 bg-[#0F766E]/10 text-[#0F766E] border border-[#0F766E]/30 rounded-lg text-xs font-mono font-bold">
            {message}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3.5 px-4 bg-white dark:bg-[#182233] hover:bg-gray-50 dark:hover:bg-[#202b3d] text-[#14213D] dark:text-white border border-[#5B6472]/30 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-[#5B6472]/20" />
          <span className="px-3 text-[10px] font-mono text-secondary-var uppercase">Or Magic Email Link</span>
          <div className="flex-1 border-t border-[#5B6472]/20" />
        </div>

        {/* Email Magic Link Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-bold text-primary-var uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@hospital.org"
              className="w-full p-3 border border-gray-300 dark:border-[#2A3547] rounded-xl text-xs font-mono bg-white dark:bg-[#101720] focus:ring-2 focus:ring-[#D62828] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#14213D] hover:bg-black text-white font-mono font-extrabold text-xs rounded-xl shadow transition-colors"
          >
            {loading ? "Sending Link..." : "✉️ Send Magic Login Link"}
          </button>
        </form>

        <p className="text-[10px] font-mono text-center text-secondary-var">
          By signing in, you agree to BloodLink privacy shield and medical verification terms.
        </p>

      </div>
    </div>
  );
}
