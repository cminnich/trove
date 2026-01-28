"use client";

import { useEffect, useState } from "react";
import { GitFork } from "lucide-react";
import Link from "next/link";

interface LineageData {
  forked_from: {
    owner_username: string | null;
    collection_name: string | null;
    collection_id: string | null;
    still_exists: boolean;
  } | null;
  fork_count: number;
}

interface ForkBreadcrumbProps {
  collectionId: string;
}

export function ForkBreadcrumb({ collectionId }: ForkBreadcrumbProps) {
  const [lineage, setLineage] = useState<LineageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLineage() {
      try {
        const res = await fetch(`/api/collections/${collectionId}/lineage`);
        const data = await res.json();
        if (data.success) {
          setLineage(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch lineage:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchLineage();
  }, [collectionId]);

  if (loading || !lineage?.forked_from) {
    return null;
  }

  const { forked_from } = lineage;

  return (
    <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
      <GitFork className="w-3 h-3" />
      <span>Forked from</span>
      {forked_from.still_exists && forked_from.collection_id ? (
        <Link
          href={`/collections/${forked_from.collection_id}`}
          className="text-open-green hover:text-emerald-400 transition-colors"
        >
          @{forked_from.owner_username}/{forked_from.collection_name}
        </Link>
      ) : (
        <span className="text-slate-400">
          @{forked_from.owner_username}/{forked_from.collection_name}
          <span className="text-slate-600 ml-1">(deleted)</span>
        </span>
      )}
    </div>
  );
}
