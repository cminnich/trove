"use client";

import { useState, useEffect } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase-client";

interface StarButtonProps {
  collectionId: string;
  initialIsStarred: boolean;
  initialStarCount: number;
  ownerId?: string;
  className?: string;
}

export function StarButton({
  collectionId,
  initialIsStarred,
  initialStarCount,
  ownerId,
  className = "",
}: StarButtonProps) {
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const [starCount, setStarCount] = useState(initialStarCount);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user on mount
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Don't show button if user owns the collection
  if (ownerId && currentUserId && ownerId === currentUserId) {
    return null;
  }

  async function handleToggleStar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Check if user is authenticated
    if (!currentUserId) {
      toast.error("Please sign in to star collections");
      return;
    }

    // Optimistic UI update
    const previousIsStarred = isStarred;
    const previousStarCount = starCount;

    setIsStarred(!isStarred);
    setStarCount(isStarred ? starCount - 1 : starCount + 1);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/collections/${collectionId}/star`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle star");
      }

      // Update with server response
      setIsStarred(data.isStarred);
      setStarCount(data.starCount);

      toast.success(data.isStarred ? "Collection starred!" : "Collection unstarred");
    } catch (error) {
      // Revert optimistic update on error
      setIsStarred(previousIsStarred);
      setStarCount(previousStarCount);

      console.error("Failed to toggle star:", error);
      toast.error(error instanceof Error ? error.message : "Failed to toggle star");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggleStar}
      disabled={isLoading}
      className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors font-mono text-xs ${
        isStarred
          ? "text-open-green hover:text-emerald-400"
          : "text-slate-500 hover:text-slate-300"
      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
      title={isStarred ? "Unstar collection" : "Star collection"}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Star
          className={`w-4 h-4 ${isStarred ? "fill-open-green" : ""}`}
        />
      )}
      <span className="tabular-nums">{starCount}</span>
    </button>
  );
}
