import { Compass, FolderOpen, GraduationCap, Link2, LogOut, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User } from "../types";
import { cn } from "../types";

export type AppView = "browse" | "post" | "profile";

interface SidebarProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-lavender text-primary" : "text-muted hover:bg-background hover:text-ink"
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
        <Link2 className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-ink">Caplink</span>
    </div>
  );
}

function AuthBlock({ user, onLoginClick, onLogout, compact }: SidebarProps & { compact?: boolean }) {
  if (user) {
    return (
      <div className={cn("flex items-center gap-2.5", compact && "min-w-0")}>
        <img
          src={user.avatar_url}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full border border-border"
        />
        <span className={cn("min-w-0 truncate text-sm font-medium text-ink", compact && "hidden sm:inline")}>
          {user.name || user.email}
        </span>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-background hover:text-ink"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={onLoginClick} className={cn(compact ? "btn-primary px-3 py-1.5 text-xs" : "btn-primary w-full")}>
      Log in
    </button>
  );
}

/** Fixed-width left sidebar for desktop (hidden below lg). */
export function Sidebar(props: SidebarProps) {
  const { view, onNavigate, user, onLoginClick } = props;
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-surface">
      <div className="flex h-16 items-center px-5">
        <Brand />
      </div>

      <nav className="flex-1 space-y-1 px-3 pt-2" aria-label="Main navigation">
        <NavItem icon={Compass} label="Explore" active={view === "browse"} onClick={() => onNavigate("browse")} />
        <NavItem
          icon={FolderOpen}
          label="My Listings"
          active={view === "profile"}
          onClick={() => (user ? onNavigate("profile") : onLoginClick())}
        />
      </nav>

      <div className="space-y-4 border-t border-border p-4">
        <button
          type="button"
          onClick={() => (user ? onNavigate("post") : onLoginClick())}
          className="btn-primary w-full"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Listing
        </button>

        <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2.5">
          <GraduationCap className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">East West University</p>
            <p className="truncate text-[11px] text-muted">CSE Capstone Community</p>
          </div>
        </div>
        <p className="px-1 text-[11px] leading-relaxed text-muted">
          Find your people. Build your capstone.
        </p>

        <AuthBlock {...props} />
      </div>
    </aside>
  );
}

/** Compact top bar for mobile / tablet (lg and below). */
export function MobileNav(props: SidebarProps) {
  const { view, onNavigate, user, onLoginClick } = props;
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <Brand />

        <nav className="ml-auto flex items-center gap-1" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => onNavigate("browse")}
            aria-current={view === "browse" ? "page" : undefined}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
              view === "browse" ? "bg-lavender text-primary" : "text-muted hover:text-ink"
            )}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => (user ? onNavigate("profile") : onLoginClick())}
            aria-current={view === "profile" ? "page" : undefined}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
              view === "profile" ? "bg-lavender text-primary" : "text-muted hover:text-ink"
            )}
          >
            My Listings
          </button>
          <button
            type="button"
            onClick={() => (user ? onNavigate("post") : onLoginClick())}
            aria-label="Create Listing"
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition hover:bg-primary/90"
          >
            <Plus className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </nav>

        <div className="ml-1 border-l border-border pl-3">
          <AuthBlock {...props} compact />
        </div>
      </div>
    </header>
  );
}
