"use client";

import { useState } from "react";
import { GitFork, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ForkButtonProps {
  collectionId: string;
  collectionName: string;
  itemCount: number;
}

export function ForkButton({ collectionId, collectionName, itemCount }: ForkButtonProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [forking, setForking] = useState(false);

  async function handleFork() {
    try {
      setForking(true);
      const res = await fetch(`/api/collections/${collectionId}/fork`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        toast.success(`Forked "${collectionName}" to your Trove!`);
        setShowDialog(false);
        router.push(`/collections/${data.data.forked_collection_id}`);
      } else {
        toast.error(data.error || "Failed to fork collection");
      }
    } catch (error) {
      console.error("Failed to fork:", error);
      toast.error("Failed to fork collection");
    } finally {
      setForking(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex-shrink-0 px-3 sm:px-4 py-2 bg-open-green hover:bg-emerald-400 text-void font-mono font-bold rounded-lg transition-colors flex items-center gap-2 text-sm shadow-hard"
        title="Fork this collection to your Trove"
      >
        <GitFork className="w-4 h-4" />
        <span className="hidden sm:inline">Fork to My Trove</span>
        <span className="sm:hidden">Fork</span>
      </button>

      {/* Fork Confirmation Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-void border border-slate-800 rounded-lg shadow-hard max-w-md w-full overflow-hidden">
            {/* Dialog Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-open-green/20 flex items-center justify-center">
                  <GitFork className="w-5 h-5 text-open-green" />
                </div>
                <div>
                  <h2 className="font-mono font-bold text-white">Fork Collection</h2>
                  <p className="text-xs text-slate-500 font-mono">Create your own copy</p>
                </div>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Dialog Body */}
            <div className="p-4 space-y-4">
              <div className="font-mono text-sm">
                <p className="text-slate-300 mb-3">
                  This will create a copy of <span className="text-white font-bold">&ldquo;{collectionName}&rdquo;</span> in your Trove.
                </p>

                <div className="bg-slate-deep border border-slate-800 rounded p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Items cloned:</span>
                    <span className="text-open-green">{itemCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Filters & schemas:</span>
                    <span className="text-open-green">Included</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Initial visibility:</span>
                    <span className="text-slate-300">Private</span>
                  </div>
                </div>

                <p className="text-slate-500 text-xs mt-3">
                  You can edit, reorganize, and make your fork public anytime.
                </p>
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800">
              <button
                onClick={() => setShowDialog(false)}
                className="px-4 py-2 text-sm font-mono text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFork}
                disabled={forking}
                className="flex items-center gap-2 px-6 py-2 text-sm font-mono font-bold text-void bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg shadow-hard transition-colors"
              >
                {forking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Forking...
                  </>
                ) : (
                  <>
                    <GitFork className="w-4 h-4" />
                    Fork Collection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
