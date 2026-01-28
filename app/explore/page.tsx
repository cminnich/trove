"use client";

import { useState } from "react";
import useSWR from "swr";
import { PublicCollectionGrid } from "@/app/collections/components/PublicCollectionGrid";
import { RefreshCw } from "lucide-react";
import Link from "next/link";

interface PublicCollection {
  id: string;
  name: string;
  owner_username: string;
  item_count: number;
  fork_count: number;
  thumbnail_urls: string[];
}

interface PublicCollectionResponse {
  success: boolean;
  data?: PublicCollection[];
  total?: number;
  error?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ExplorePage() {
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);

  const { data: response, error, isLoading, mutate } = useSWR<PublicCollectionResponse>(
    `/api/collections/public?limit=${limit}&offset=${offset}`,
    fetcher
  );

  const collections = response?.data || [];
  const total = response?.total || 0;
  const hasMore = collections.length + offset < total;

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const handleRetry = () => {
    mutate();
  };

  return (
    <main className="min-h-screen bg-void text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-mono text-3xl font-bold tracking-widest uppercase text-open-green">
              Explore Public Troves
            </h1>
            <Link
              href="/collections"
              className="px-4 py-2 border border-slate-800 hover:border-open-green text-slate-300 hover:text-open-green font-mono text-sm rounded-lg transition-colors"
            >
              My Collections
            </Link>
          </div>

          {!isLoading && !error && (
            <p className="font-mono text-slate-400 text-sm">
              {total} public {total === 1 ? "collection" : "collections"} • Fork any to start your own
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
            <p className="font-mono text-red-300 mb-4">
              Failed to load collections. Try again later.
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-2 bg-open-green hover:bg-emerald-400 text-void font-mono font-bold rounded-lg transition-colors flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* Collections Grid */}
        {!error && (
          <>
            <PublicCollectionGrid collections={collections} isLoading={isLoading} />

            {/* Load More */}
            {hasMore && !isLoading && (
              <div className="mt-8 text-center">
                <button
                  onClick={handleLoadMore}
                  className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono font-bold rounded-lg transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800 text-center">
          <p className="font-mono text-xs text-slate-600 uppercase tracking-wider">
            All collections are open source • Fork freely • Export anytime
          </p>
        </div>
      </div>
    </main>
  );
}
