"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SystemStatus } from "@/app/components/Stats/SystemStatus";
import { getClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  return (
    <main className="min-h-screen bg-void text-white">
      <div className="flex flex-col items-center justify-center min-h-screen p-6 md:p-12">
        <div className="w-full max-w-2xl space-y-8">
          {/* Logo / Title */}
          <div className="text-center">
            <h1 className="font-mono text-4xl md:text-5xl font-bold tracking-widest uppercase text-open-green">
              Open Trove
            </h1>
          </div>

          {/* Manifesto */}
          <div className="border border-slate-800 p-6 md:p-8 rounded-md shadow-hard">
            <p className="font-mono text-lg md:text-xl text-slate-300 leading-relaxed">
              &ldquo;The community-owned library of gear, collections, and enthusiast knowledge.{" "}
              <span className="text-open-green">Public by default.</span>{" "}
              <span className="text-open-green">Open source.</span>{" "}
              <span className="text-open-green">Exportable forever.</span>&rdquo;
            </p>
          </div>

          {/* System Status */}
          <div className="flex justify-center">
            <SystemStatus />
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 bg-open-green hover:bg-emerald-400 text-void font-mono font-bold px-8 py-4 rounded-md transition-colors shadow-hard text-lg"
            >
              BROWSE PUBLIC
            </Link>
            {!loading && (
              user ? (
                <Link
                  href="/collections"
                  className="inline-flex items-center justify-center gap-2 border border-slate-800 hover:border-open-green text-slate-300 hover:text-open-green font-mono font-bold px-8 py-4 rounded-md transition-colors shadow-hard text-lg"
                >
                  VIEW MY COLLECTIONS
                </Link>
              ) : (
                <Link
                  href="/collections"
                  className="inline-flex items-center justify-center gap-2 border border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white font-mono font-bold px-8 py-4 rounded-md transition-colors shadow-hard text-lg"
                >
                  START YOUR TROVE
                </Link>
              )
            )}
          </div>

          {/* Login link for existing users */}
          {!loading && !user && (
            <div className="text-center">
              <Link
                href="/auth/login"
                className="font-mono text-sm text-slate-500 hover:text-open-green transition-colors"
              >
                Already have an account? <span className="underline">Log in</span>
              </Link>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-center pt-8">
            <p className="font-mono text-xs text-slate-600 uppercase tracking-wider">
              Fork collections. Build on others&apos; work. Keep your data.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
