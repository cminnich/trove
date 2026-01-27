"use client";

import { useState, useEffect } from "react";
import { BottomSheet } from "@/app/components/BottomSheet";
import {
  Users,
  Mail,
  Loader2,
  Check,
  X,
  Crown,
  Clock,
  UserCheck,
  Trash2,
} from "lucide-react";
import type { Database } from "@/types/database";

type Collection = Database["public"]["Tables"]["collections"]["Row"];

interface Collaborator {
  id: string;
  invited_identity: string;
  access_level: "viewer" | "editor";
  granted_at: string;
  claimed_at: string | null;
  user_id: string | null;
  profile: {
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface Owner {
  id: string;
  email: string | null;
  avatar_url: string | null;
}

interface ShareCollectionDialogProps {
  open: boolean;
  onClose: () => void;
  collection: Collection;
}

export function ShareCollectionDialog({
  open,
  onClose,
  collection,
}: ShareCollectionDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form state
  const [email, setEmail] = useState("");
  const [accessLevel, setAccessLevel] = useState<"viewer" | "editor">("viewer");

  // Fetch collaborators when dialog opens
  useEffect(() => {
    if (open) {
      fetchCollaborators();
    }
  }, [open, collection.id]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function fetchCollaborators() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/collections/${collection.id}/access`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch collaborators");
      }

      setCollaborators(data.data.collaborators);
      setOwner(data.data.owner);
    } catch (err) {
      console.error("Failed to fetch collaborators:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch collaborators");
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      setInviting(true);
      setError(null);

      const res = await fetch(`/api/collections/${collection.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          access_level: accessLevel,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send invitation");
      }

      // Clear form and refresh list
      setEmail("");
      setAccessLevel("viewer");
      setSuccess("Invitation sent successfully!");
      await fetchCollaborators();
    } catch (err) {
      console.error("Failed to invite:", err);
      setError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(accessId: string) {
    try {
      setRemovingId(accessId);
      setError(null);

      const res = await fetch(
        `/api/collections/${collection.id}/access?access_id=${accessId}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to revoke access");
      }

      setSuccess("Access revoked successfully!");
      await fetchCollaborators();
    } catch (err) {
      console.error("Failed to remove access:", err);
      setError(err instanceof Error ? err.message : "Failed to revoke access");
    } finally {
      setRemovingId(null);
    }
  }

  const handleClose = () => {
    if (!inviting && !removingId) {
      setError(null);
      setSuccess(null);
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={handleClose} title="Share Collection">
      <div className="space-y-6">
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-start gap-2">
            <X className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {/* Invite Form Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Invite Collaborator
          </h3>

          <form onSubmit={handleInvite} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  disabled={inviting}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div className="flex-shrink-0">
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as "viewer" | "editor")}
                  disabled={inviting}
                  className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="viewer">Can View</option>
                  <option value="editor">Can Edit</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={inviting || !email.trim()}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            <strong>Viewer:</strong> Can view the collection and its items.{" "}
            <strong>Editor:</strong> Can view, add/remove items, and edit collection settings.
          </p>
        </div>

        {/* Collaborators List Section */}
        <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            People with Access
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Owner */}
              {owner && (
                <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center flex-shrink-0">
                      {owner.avatar_url ? (
                        <img
                          src={owner.avatar_url}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <Crown className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {owner.email || "Owner"}
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Owner</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Collaborators */}
              {collaborators.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No collaborators yet. Invite someone to get started!
                </p>
              ) : (
                collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {collaborator.profile?.avatar_url ? (
                          <img
                            src={collaborator.profile.avatar_url}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : collaborator.claimed_at ? (
                          <UserCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Clock className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {collaborator.profile?.email || collaborator.invited_identity}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              collaborator.access_level === "editor"
                                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {collaborator.access_level === "editor" ? "Editor" : "Viewer"}
                          </span>
                          {!collaborator.claimed_at && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(collaborator.id)}
                      disabled={removingId === collaborator.id}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove access"
                    >
                      {removingId === collaborator.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
