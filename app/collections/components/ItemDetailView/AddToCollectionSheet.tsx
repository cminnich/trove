"use client";

import { useState } from "react";
import { X, Plus, Loader2, Check } from "lucide-react";
import { useCollections } from "@/app/hooks/useCollections";
import { toast } from "sonner";

interface AddToCollectionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
}

export function AddToCollectionSheet({
  isOpen,
  onClose,
  itemId,
  itemName,
}: AddToCollectionSheetProps) {
  const { collections, isLoading: loadingCollections } = useCollections();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!selectedCollectionId) return;

    try {
      setAdding(true);
      const res = await fetch(`/api/collections/${selectedCollectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });

      const data = await res.json();

      if (data.success) {
        const targetCollection = collections.find((c) => c.id === selectedCollectionId);
        toast.success(`Added "${itemName}" to ${targetCollection?.name || "collection"}`);
        onClose();
      } else {
        // Backend handles "already exists" case gracefully
        toast.error(data.error || "Failed to add item");
      }
    } catch (error) {
      console.error("Failed to add item:", error);
      toast.error("Failed to add item to collection");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-void border-t md:border border-slate-800 rounded-t-xl md:rounded-xl shadow-hard w-full md:max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="font-mono font-bold text-white text-lg">Add to Collection</h2>
            <p className="text-xs text-slate-500 font-mono mt-1">
              Select a collection to add this item
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Collections List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loadingCollections ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-open-green animate-spin" />
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-mono text-slate-400 mb-4">No collections yet</p>
              <p className="text-xs font-mono text-slate-600">
                Create a collection first to add items
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {collections.map((collection) => {
                const isShared = (collection as { access_type?: string }).access_type === "editor";
                return (
                  <button
                    key={collection.id}
                    onClick={() => setSelectedCollectionId(collection.id)}
                    className={`w-full p-3 rounded-lg border transition-colors text-left ${
                      selectedCollectionId === collection.id
                        ? "border-open-green bg-open-green/10"
                        : "border-slate-800 hover:border-slate-700 bg-slate-deep"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-mono font-semibold text-white text-sm truncate flex items-center gap-2">
                          {collection.name}
                          {isShared && (
                            <span className="text-xs font-normal text-slate-500">(Shared)</span>
                          )}
                        </h3>
                        {collection.description && (
                          <p className="text-xs font-mono text-slate-500 truncate mt-0.5">
                            {collection.description}
                          </p>
                        )}
                      </div>
                      {selectedCollectionId === collection.id && (
                        <Check className="w-5 h-5 text-open-green ml-2 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedCollectionId || adding}
            className="flex items-center gap-2 px-6 py-2 text-sm font-mono font-bold text-void bg-open-green hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg shadow-hard transition-colors"
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add to Collection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
