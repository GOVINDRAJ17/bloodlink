"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "./ThemeProvider";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const supabase = createClient();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const initials = user?.user_metadata?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || user?.email?.substring(0, 2).toUpperCase() || "BL";

  const navLinks = [
    { name: "Search", href: "/search" },
    { name: "Donor", href: "/dashboard/donor" },
    { name: "Hospital", href: "/dashboard/hospital" },
    { name: "Emergencies", href: "/requests" },
    { name: "Map", href: "/map" },
    { name: "Analytics", href: "/analytics" },
    { name: "Profile", href: "/profile" }
  ];

  return (
    <header className="sticky top-0 z-50 w-full h-16 glass-navbar text-white select-none transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 md:px-6 h-full flex items-center justify-between">
        
        {/* Left: Wordmark with Pulse-Dot Accent */}
        <Link
          href="/"
          className="flex items-center gap-2.5 font-heading font-extrabold text-xl tracking-tight text-white hover:opacity-90 transition-all shrink-0 active:scale-95"
        >
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E11D48] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E11D48]" />
          </div>
          <span className="bg-gradient-to-r from-white via-white to-gray-200 bg-clip-text text-transparent">
            BloodLink
          </span>
        </Link>

        {/* Center: Sliding Animated Pill Role Switcher */}
        <nav className="hidden lg:flex items-center bg-black/25 dark:bg-white/5 p-1 rounded-full border border-white/10 text-xs font-mono font-bold">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3.5 py-1.5 rounded-full transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 bg-[#E11D48] rounded-full shadow-md shadow-[#E11D48]/30"
                  />
                )}
                <span className={`relative z-10 ${isActive ? "text-white font-extrabold" : "text-gray-300 hover:text-white"}`}>
                  {link.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Theme Toggle, Notifications, User Avatar Link */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="h-9 min-w-[76px] text-gray-300 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-all text-xs font-mono flex items-center justify-center gap-1.5 border border-white/10 px-2.5 shrink-0 active:scale-95"
            title={`Switch to ${theme === "light" ? "Dark" : "Light"} mode`}
          >
            <span className="text-sm leading-none">{theme === "light" ? "🌙" : "☀️"}</span>
            <span className="hidden sm:inline text-[11px] font-bold uppercase w-10 text-center">{theme === "light" ? "Dark" : "Light"}</span>
          </button>

          {/* Notification Bell */}
          <Link
            href="/requests"
            className="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all relative shrink-0 active:scale-95"
            title="Active Dispatches & Alerts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E11D48] rounded-full ring-2 ring-[#0F172A]" />
          </Link>

          {/* Avatar Profile Link */}
          {loading ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-white/10 shrink-0" />
          ) : user ? (
            <Link
              href="/profile"
              className="flex items-center gap-2 group transition-all"
              title="View Profile & Manage Account"
            >
              <div className="relative">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt={user.email ?? "User"}
                    className="h-9 w-9 rounded-full border-2 border-white/20 group-hover:border-[#E11D48] object-cover transition-colors"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#0F766E] to-[#0D9488] text-white text-xs font-mono font-bold flex items-center justify-center border-2 border-white/20 group-hover:border-[#E11D48] transition-colors shadow-sm">
                    {initials}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0F172A]" />
              </div>
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className="px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-mono font-bold text-xs shadow-md shadow-[#E11D48]/25 transition-all shrink-0 active:scale-95"
            >
              Sign In
            </Link>
          )}

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white transition-colors"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

        </div>

      </div>

      {/* Animated Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="lg:hidden border-t border-white/10 bg-[#0F172A]/95 backdrop-blur-xl px-4 py-4 space-y-2 overflow-hidden shadow-2xl"
          >
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-2.5 rounded-xl font-mono text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-[#E11D48] text-white shadow-md shadow-[#E11D48]/20"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

    </header>
  );
}