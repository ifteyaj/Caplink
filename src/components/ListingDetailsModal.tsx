import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Facebook, Lock, Mail, User as UserIcon, Users, X } from "lucide-react";
import type { Listing } from "../types";
import { cn, parseSkills } from "../types";
import { ListingTypeBadge, majorStyleFor } from "./ExploreCard";

interface ListingDetailsModalProps {
  listing: Listing | null;
  onClose: () => void;
  /** Opens the existing LoginModal; only shown while contact info is locked. */
  onLoginRequest: () => void;
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

/**
 * Detail view for a single listing, built entirely from the row already
 * fetched via GET /api/listings (no detail endpoint exists).
 *
 * Contact privacy is driven by the backend: when `is_locked` is true the
 * contact fields are null and must not be rendered.
 */
export function ListingDetailsModal({ listing, onClose, onLoginRequest }: ListingDetailsModalProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!listing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [listing, onClose]);

  const majorStyle = listing ? majorStyleFor(listing.major) : null;
  const MajorIcon = majorStyle?.icon;
  const skills = listing ? parseSkills(listing.skills) : [];
  const showSlots = listing?.type === "group" && listing.slots_open !== null;
  const isLocked = listing?.is_locked === true;

  return (
    <AnimatePresence>
      {listing && MajorIcon && majorStyle && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Close listing details"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="listing-details-title"
            className="card relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-b-none p-6 sm:rounded-2xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
          >
            <h2 id="listing-details-title" className="sr-only">
              Listing details
            </h2>

            {/* Header: major + type + close */}
            <div className="flex items-center gap-2.5">
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
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-background hover:text-ink"
              >
                <X className="h-4.5 w-4.5" aria-hidden="true" />
              </button>
            </div>

            {/* Initiative — full text */}
            <section className="mt-5">
              <p className="label">
                {listing.type === "solo" ? "What this student wants to work on" : "What this group wants to work on"}
              </p>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink">
                {listing.project_idea}
              </p>
            </section>

            {/* Skills */}
            {skills.length > 0 && (
              <section className="mt-5">
                <p className="label">Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-lg bg-lavender px-2.5 py-1 text-xs font-medium text-primary"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Team situation */}
            {showSlots && (
              <section className="mt-5">
                <p className="label">Team</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                  {listing.slots_open} {listing.slots_open === 1 ? "member" : "members"} needed
                </p>
              </section>
            )}

            {/* Contact — locked vs unlocked */}
            <section className="mt-5">
              <p className="label">Contact</p>
              {isLocked ? (
                <div className="mt-2 rounded-xl border border-border bg-background p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-medium text-ink">
                    <Lock className="h-4 w-4 text-primary" aria-hidden="true" />
                    Contact information is locked
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Log in with your EWU email to view contact details for this listing.
                  </p>
                  <button type="button" onClick={onLoginRequest} className="btn-primary mt-3 w-full sm:w-auto">
                    Log in to view contact
                  </button>
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {listing.email && (
                    <li>
                      <a
                        href={`mailto:${listing.email}`}
                        className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-primary"
                      >
                        <Mail className="h-4 w-4 text-muted" aria-hidden="true" />
                        {listing.email}
                      </a>
                    </li>
                  )}
                  {listing.facebook && (
                    <li>
                      {isHttpUrl(listing.facebook) ? (
                        <a
                          href={listing.facebook}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-ink transition hover:text-primary"
                        >
                          <Facebook className="h-4 w-4 text-muted" aria-hidden="true" />
                          {listing.facebook}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-sm text-ink">
                          <Facebook className="h-4 w-4 text-muted" aria-hidden="true" />
                          {listing.facebook}
                        </span>
                      )}
                    </li>
                  )}
                  {!listing.email && !listing.facebook && (
                    <li className="inline-flex items-center gap-2 text-sm text-muted">
                      <UserIcon className="h-4 w-4" aria-hidden="true" />
                      No contact details were provided for this listing.
                    </li>
                  )}
                </ul>
              )}
            </section>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
