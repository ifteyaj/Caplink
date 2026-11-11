import { ArrowRight, BarChart3, BookOpen, Code2, Cpu, Radio, User as UserIcon, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Listing } from "../types";
import { parseSkills, cn } from "../types";

export interface MajorStyle {
  icon: LucideIcon;
  /** Icon + label color */
  iconClass: string;
  /** Tinted major panel background */
  tileClass: string;
  /** Card edge stripe */
  stripeClass: string;
}

/**
 * Visual treatment per major category. Keyed by the same strings as `MAJORS`
 * in src/types.ts; unknown free-text majors fall back to the indigo treatment.
 */
export const majorMeta: Record<string, MajorStyle> = {
  "Data Science": {
    icon: BarChart3,
    iconClass: "text-sky-600",
    tileClass: "bg-sky-soft",
    stripeClass: "bg-sky-400",
  },
  "Software Engineering": {
    icon: Code2,
    iconClass: "text-primary",
    tileClass: "bg-lavender",
    stripeClass: "bg-primary",
  },
  "Hardware Engineering": {
    icon: Cpu,
    iconClass: "text-emerald-600",
    tileClass: "bg-mint",
    stripeClass: "bg-emerald-400",
  },
  "Communication Engineering": {
    icon: Radio,
    iconClass: "text-orange-600",
    tileClass: "bg-peach",
    stripeClass: "bg-orange-400",
  },
};

const fallbackStyle: MajorStyle = {
  icon: BookOpen,
  iconClass: "text-primary",
  tileClass: "bg-lavender",
  stripeClass: "bg-primary",
};

export function majorStyleFor(major: string): MajorStyle {
  return majorMeta[major] ?? fallbackStyle;
}

/** Compact Solo / Group badge — small and scannable, never a card heading. */
export function ListingTypeBadge({ type }: { type: Listing["type"] }) {
  const isSolo = type === "solo";
  const Icon = isSolo ? UserIcon : Users;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        isSolo ? "bg-lavender text-primary" : "bg-teal-50 text-teal-700"
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {isSolo ? "Solo" : "Group"}
    </span>
  );
}

const MAX_SKILLS_SHOWN = 3;

interface ExploreCardProps {
  listing: Listing;
  onViewDetails: (listing: Listing) => void;
}

/**
 * Discovery card. Visual hierarchy: major → initiative (`project_idea`) → Solo/Group.
 * Never renders the student's name, photos, academic years, or deadlines
 * (the backend has no such fields; `listings.name` is the student's name).
 */
export function ExploreCard({ listing, onViewDetails }: ExploreCardProps) {
  const style = majorStyleFor(listing.major);
  const MajorIcon = style.icon;
  const skills = parseSkills(listing.skills);
  const showSlots = listing.type === "group" && listing.slots_open !== null;
  const extraSkills = Math.max(0, skills.length - MAX_SKILLS_SHOWN);

  return (
    <article className="card card-hover relative flex flex-col gap-4 overflow-hidden p-4 pl-5 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
      {/* Colored edge stripe for the major */}
      <span aria-hidden="true" className={cn("absolute inset-y-4 left-0 w-1 rounded-full", style.stripeClass)} />

      {/* LEFT — compact major indicator */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 sm:w-28 sm:flex-col sm:justify-center sm:gap-1.5 sm:py-4 sm:text-center",
          style.tileClass
        )}
      >
        <MajorIcon className={cn("h-5 w-5 shrink-0 sm:h-7 sm:w-7", style.iconClass)} aria-hidden="true" />
        <span className={cn("text-xs font-semibold leading-tight", style.iconClass)}>{listing.major}</span>
      </div>

      {/* RIGHT — initiative, team situation, actions */}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="line-clamp-3 text-[15px] leading-relaxed text-ink">{listing.project_idea}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ListingTypeBadge type={listing.type} />
          {skills.slice(0, MAX_SKILLS_SHOWN).map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-lavender px-2.5 py-1 text-xs font-medium text-primary"
            >
              {skill}
            </span>
          ))}
          {extraSkills > 0 && (
            <span className="rounded-full bg-lavender px-2.5 py-1 text-xs font-semibold text-primary">
              +{extraSkills}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          {showSlots && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {listing.slots_open} {listing.slots_open === 1 ? "member" : "members"} needed
            </p>
          )}
          <button
            type="button"
            onClick={() => onViewDetails(listing)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-3.5 py-1.5 text-xs font-semibold text-primary transition hover:border-primary/40 hover:bg-lavender/60"
          >
            View Details
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
