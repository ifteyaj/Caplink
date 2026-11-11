import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2, Plus, Trash2 } from "lucide-react";
import type { Listing, User } from "../types";
import { cn, parseSkills } from "../types";
import { majorStyleFor, ListingTypeBadge } from "./ExploreCard";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

interface MyListingsPageProps {
  user: User;
  onCreateClick: () => void;
  onLoginClick: () => void;
}

/**
 * Shows the authenticated student's own listings from the real
 * `GET /api/my-listings` endpoint (not derived from the public feed),
 * with delete via `DELETE /api/listings/:id`.
 */
export function MyListingsPage({ user, onCreateClick, onLoginClick }: MyListingsPageProps) {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsUnauthorized(false);
    try {
      const response = await fetch("/api/my-listings");
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Failed to load your listings";
        if (response.status === 401) {
          setIsUnauthorized(true);
          setError("Your session has expired. Please log in again.");
        } else {
          setError(message);
        }
        return;
      }
      setListings(Array.isArray(data) ? (data as Listing[]) : []);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (listing: Listing) => {
    const confirmed = window.confirm("Delete this listing? This cannot be undone.");
    if (!confirmed) return;

    setDeletingId(listing.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/listings/${listing.id}`, { method: "DELETE" });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Failed to delete listing";
        throw new Error(message);
      }
      setListings((prev) => prev?.filter((item) => item.id !== listing.id) ?? []);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to delete listing");
    } finally {
      setDeletingId(null);
    }
  };

  const heading = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">My Listings</h1>
        <p className="mt-1 text-sm text-muted">
          Listings posted by {user.name || user.email}.
        </p>
      </div>
      <button type="button" onClick={onCreateClick} className="btn-primary">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create Listing
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {heading}

      {notice && (
        <p role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          {notice}
        </p>
      )}

      {loading ? (
        <LoadingSkeleton count={2} />
      ) : error ? (
        <EmptyState
          icon={FolderOpen}
          title="Could not load your listings"
          description={error}
          action={
            isUnauthorized ? (
              <button type="button" onClick={onLoginClick} className="btn-primary">
                Log in
              </button>
            ) : (
              <button type="button" onClick={() => void load()} className="btn-primary">
                Retry
              </button>
            )
          }
        />
      ) : !listings || listings.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No listings yet"
          description="Post your first initiative so teammates can find you."
          action={
            <button type="button" onClick={onCreateClick} className="btn-primary">
              Create Listing
            </button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {[...listings]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((listing) => {
              const majorStyle = majorStyleFor(listing.major);
              const MajorIcon = majorStyle.icon;
              const skills = parseSkills(listing.skills);
              const deleting = deletingId === listing.id;
              return (
                <li key={listing.id} className="card p-5">
                  <div className="flex flex-wrap items-start gap-3">
                    <span
                      className={cn(
                        "inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold",
                        majorStyle.tileClass,
                        majorStyle.iconClass
                      )}
                    >
                      <MajorIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{listing.major}</span>
                    </span>
                    <ListingTypeBadge type={listing.type} />
                    <button
                      type="button"
                      onClick={() => void handleDelete(listing)}
                      disabled={deleting}
                      aria-label={`Delete listing: ${listing.project_idea.slice(0, 40)}`}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      {deleting ? (
                        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Delete
                    </button>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink">
                    {listing.project_idea}
                  </p>
                  {skills.length > 0 && (
                    <p className="mt-2 text-xs text-muted">Skills: {skills.join(", ")}</p>
                  )}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
