"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "./ThemeProvider";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (err) {
        console.error("Header auth state error:", err);
      } finally {
        setLoading(false);
      }
    }

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/auth/login");
  };

  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || user?.email?.substring(0, 2).toUpperCase() || "U";

  const rolePills = [
    { name: "Search", href: "/search" },
    { name: "Donor", href: "/dashboard/donor" },
    { name: "Hospital", href: "/dashboard/hospital" },
    { name: "Emergencies", href: "/requests" },
    { name: "Map", href: "/map" },
    { name: "Analytics", href: "/analytics" },
    { name: "Profile", href: "/profile" }
  ];

  return (
    <header className="sticky top-0 z-50 w-full h-16 bg-[#14213D] text-white shadow-md select-none">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-full flex items-center justify-between">
        
        {/* Left: Wordmark with Pulse-Dot Accent */}
        <Link href="/" className="flex items-center gap-2 font-heading font-extrabold text-xl tracking-tight text-white hover:opacity-90 transition-opacity shrink-0">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D62828] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D62828]" />
          </div>
          <span>BloodLink</span>
        </Link>

        {/* Center: Pill-Style Role Switcher Shell */}
        <nav className="hidden md:flex items-center bg-[#1e2e50] p-1 rounded-full border border-white/10 text-xs font-semibold">
          {rolePills.map((pill) => {
            const isActive = pathname === pill.href;
            return (
              <Link
                key={pill.href}
                href={pill.href}
                className={`px-3.5 py-1.5 rounded-full transition-all ${
                  isActive
                    ? "bg-[#D62828] text-white font-extrabold shadow-sm"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                {pill.name}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Theme Toggle, Notifications, User Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Light / Dark Mode Toggle with FIXED width to prevent navbar layout shift */}
          <button
            onClick={toggleTheme}
            className="h-9 min-w-[76px] text-gray-300 hover:text-white rounded-full hover:bg-white/10 transition-colors text-xs font-mono flex items-center justify-center gap-1.5 border border-white/10 px-2.5 shrink-0"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
          >
            <span className="text-sm leading-none">{theme === "light" ? "🌙" : "☀️"}</span>
            <span className="hidden sm:inline text-[11px] font-bold uppercase w-10 text-center">{theme === "light" ? "Dark" : "Light"}</span>
          </button>

          {/* Notification Bell */}
          <Link
            href="/requests"
            className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white rounded-full hover:bg-white/10 transition-colors relative shrink-0"
            title="Notifications & Active Alerts"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#D62828] rounded-full ring-2 ring-[#14213D]" />
          </Link>

          {/* Auth State & Avatar Link to Profile */}
          {loading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/10 shrink-0" />
          ) : user ? (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/profile"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                title="Go to My Profile & Cooldown Status"
              >
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.email ?? "User"}
                    className="h-8 w-8 rounded-full border border-white/20 object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#0F766E] text-white text-xs font-bold flex items-center justify-center border border-white/20">
                    {initials}
                  </div>
                )}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-xs px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-gray-200 transition-colors hidden sm:block font-medium"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-xs px-3.5 py-1.5 rounded-full bg-[#D62828] hover:bg-red-700 text-white font-bold transition-colors shadow-sm shrink-0"
            >
              Sign In
            </Link>
          )}

        </div>

      </div>
    </header>
  );
}