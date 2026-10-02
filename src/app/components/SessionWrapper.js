"use client";

import { AuthProvider } from "@/context/AuthContext";

export default function SessionWrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}