"use client";

import { useEffect, useState } from "react";
import { TerminalBox, TerminalHeader } from "@/app/components/Terminal";

interface Stats {
  total_public_collections: number;
  total_forks: number;
}

export function SystemStatus() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <TerminalBox className="w-full max-w-md">
      <TerminalHeader title="SYSTEM STATUS" />
      <div className="p-4 font-mono text-sm">
        {loading ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">├──</span>
              <span className="text-slate-400">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">├──</span>
              <span className="text-slate-400">Public Collections:</span>
              <span className="text-open-green font-bold">
                {stats?.total_public_collections.toLocaleString() ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">└──</span>
              <span className="text-slate-400">Community Forks:</span>
              <span className="text-open-green font-bold">
                {stats?.total_forks.toLocaleString() ?? "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    </TerminalBox>
  );
}
