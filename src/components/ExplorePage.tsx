import { useMemo, useState, type FormEvent } from "react";
import { Inbox, Search, SearchX, TriangleAlert, X } from "lucide-react";
import type { Listing, ListingStats, User } from "../types";
import { MAJORS, cn, parseSkills } from "../types";
import { ExploreCard } from "./ExploreCard";
import { EmptyState } from "./EmptyState";
import { ListingDetailsModal } from "./ListingDetailsModal";
import { LoadingSkeleton } from "./LoadingSkeleton";

type TypeFilter = "all" | "solo" | "group";
type SortDir = "recent" | "oldest";

interface ExplorePageProps {
  listings: Listing[];
  stats: ListingStats | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  user: User | null;
  onLoginClick: () => void;
  onCreateClick: () => void;
}

const TYPE_FILTERS: ReadonlyArray<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "solo", label: "Solo" },
  { value: "group", label: "Group" },
];

/** Decorative low-opacity campus silhouette for the hero. */
function CampusArt() {
  return (
    <svg
      viewBox="0 0 420 200"
      aria-hidden="true"
      className="pointer-events-none absolute -right-2 bottom-0 hidden h-full max-h-52 w-auto opacity-70 sm:block"
    >
      <circle cx="330" cy="150" r="100" fill="#E7E9FF" />
      <rect x="118" y="66" width="170" height="118" rx="6" fill="#DDE2FF" />
      <rect x="108" y="56" width="190" height="12" rx="4" fill="#C9D2FA" />
      <rect x="138" y="88" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="166" y="88" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="194" y="88" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="222" y="88" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="250" y="88" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="138" y="124" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="166" y="124" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="194" y="124" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="222" y="124" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="250" y="124" width="18" height="22" rx="2" fill="#F4F5FF" />
      <rect x="298" y="94" width="44" height="90" rx="4" fill="#E4E7FF" />
      <rect x="308" y="108" width="24" height="16" rx="2" fill="#F4F5FF" />
      <rect x="308" y="134" width="24" height="16" rx="2" fill="#F4F5FF" />
      <circle cx="76" cy="158" r="26" fill="#CBE7DB" />
      <circle cx="392" cy="172" r="30" fill="#CBE7DB" opacity="0.7" />
    </svg>
  );
}

export function ExplorePage({
  listings,
  stats,
  loading,
  error,
  onRetry,
  user,
  onLoginClick,
  onCreateClick,
}: ExplorePageProps) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortDir, setSortDir] = useState<SortDir>("recent");
  const [selected, setSelected] = useState<Listing | null>(null);

  const filteredListings = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = listings.filter((listing) => {
      if (majorFilter !== "all" && listing.major !== majorFilter) return false;
      if (typeFilter !== "all" && listing.type !== typeFilter) return false;
      if (!q) return true;
      // Search initiative text, major, and skills — never the student's name.
      const inSkills = parseSkills(listing.skills).some((skill) => skill.toLowerCase().includes(q));
      return (
        listing.project_idea.toLowerCase().includes(q) ||
        listing.major.toLowerCase().includes(q) ||
        inSkills
      );
    });

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return sortDir === "recent" ? timeB - timeA : timeA - timeB;
    });
  }, [listings, query, majorFilter, typeFilter, sortDir]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setQuery(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
  };

  const clearFilters = () => {
    clearSearch();
    setMajorFilter("all");
    setTypeFilter("all");
  };

  const hasListings = listings.length > 0;
  const hasFilters = query.trim() !== "" || majorFilter !== "all" || typeFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Hero — compact, campus-inspired, not a full-screen banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-8 sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-lavender/50 via-transparent to-transparent"
        />
        <CampusArt />
        <div className="relative max-w-xl">
          <h1 className="font-display text-[26px] font-bold leading-tight text-ink sm:text-4xl">
            Find your <span className="text-primary">capstone team</span> at EWU
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-[15px]">
            Discover exciting initiatives and connect with students looking for teammates.
          </p>
          {stats && stats.total > 0 && (
            <p className="mt-3 text-xs font-semibold text-primary/90">
              {stats.total} {stats.total === 1 ? "initiative" : "initiatives"} · {stats.solo} solo ·{" "}
              {stats.groups} {stats.groups === 1 ? "group" : "groups"}
            </p>
          )}
        </div>
      </section>

      {/* Search — prominent bar with an inline Search action */}
      <section aria-label="Search and filters" className="space-y-4">
        <form onSubmit={handleSearch} role="search" className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search initiatives, majors, or skills..."
            aria-label="Search initiatives, majors, or skills"
            className="input w-full rounded-2xl py-3.5 pl-11 pr-36 shadow-sm sm:pr-40"
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {searchInput !== "" && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-background hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
            >
              Search
            </button>
          </div>
        </form>

        {/* Major chips */}
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by major">
          {["all", ...MAJORS].map((major) => {
            const active = majorFilter === major;
            return (
              <button
                key={major}
                type="button"
                aria-pressed={active}
                onClick={() => setMajorFilter(major)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  active
                    ? "border-transparent bg-primary text-white shadow-sm"
                    : "border-border bg-surface text-ink/80 hover:border-primary/30 hover:text-ink"
                )}
              >
                {major === "all" ? "All Majors" : major}
              </button>
            );
          })}
        </div>

        {/* Type filter + sort */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex rounded-full border border-border bg-surface p-1"
            role="group"
            aria-label="Filter by listing type"
          >
            {TYPE_FILTERS.map(({ value, label }) => {
              const active = typeFilter === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeFilter(value)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                    active ? "bg-lavender text-primary" : "text-muted hover:text-ink"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted">Sort by:</span>
            <select
              value={sortDir}
              onChange={(event) => setSortDir(event.target.value as SortDir)}
              aria-label="Sort initiatives"
              className="input rounded-full py-2 pl-3.5 pr-8 text-xs font-semibold text-ink"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      </section>

      {/* States */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong"
          description={error}
          action={
            <button type="button" onClick={onRetry} className="btn-primary">
              Retry
            </button>
          }
        />
      ) : !hasListings ? (
        <EmptyState
          icon={Inbox}
          title="No capstone initiatives yet"
          description="Be the first to share an initiative and find your teammates."
          action={
            user ? (
              <button type="button" onClick={onCreateClick} className="btn-primary">
                Create Listing
              </button>
            ) : undefined
          }
        />
      ) : filteredListings.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No matching initiatives found"
          description="Try a different search term or clear your filters."
          action={
            hasFilters ? (
              <button type="button" onClick={clearFilters} className="btn-secondary">
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredListings.map((listing) => (
            <ExploreCard key={listing.id} listing={listing} onViewDetails={setSelected} />
          ))}
        </div>
      )}

      <ListingDetailsModal
        listing={selected}
        onClose={() => setSelected(null)}
        onLoginRequest={onLoginClick}
      />
    </div>
  );
}
