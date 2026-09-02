"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeRequests(hospitalId?: string) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function initialFetch() {
      try {
        let query = supabase.from("blood_requests").select("*").order("created_at", { ascending: false });
        if (hospitalId) {
          query = query.eq("hospital_id", hospitalId);
        }
        const { data } = await query;
        if (data) setRequests(data);
      } catch (err) {
        console.error("Error loading requests:", err);
      } finally {
        setLoading(false);
      }
    }

    initialFetch();

    // Subscribe to Supabase Realtime channel
    const channel = supabase
      .channel("realtime-blood-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "blood_requests",
          filter: hospitalId ? `hospital_id=eq.${hospitalId}` : undefined
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((r) => (r.id === payload.new.id ? payload.new : r))
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) => prev.filter((r) => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hospitalId]);

  return { requests, loading };
}
