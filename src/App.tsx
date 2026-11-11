import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Lock, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import type { Listing, ListingStats, User } from "./types";
import { MAJORS, SKILLS, cn } from "./types";
import { MobileNav, Sidebar, type AppView } from "./components/Sidebar";
import { ExplorePage } from "./components/ExplorePage";
import { MyListingsPage } from "./components/MyListingsPage";

/** Extract a human-readable message from the backend's flat `{ error, code, details }` envelope. */
function extractError(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null) {
    const envelope = data as { error?: unknown; details?: unknown };
    if (Array.isArray(envelope.details) && envelope.details.length > 0) {
      const first = envelope.details[0];
      if (typeof first === "object" && first !== null && "message" in first) {
        return String((first as { message: unknown }).message);
      }
    }
    if (typeof envelope.error === "string") return envelope.error;
  }
  return fallback;
}

function isStats(value: unknown): value is ListingStats {
  if (typeof value !== "object" || value === null) return false;
  const stats = value as Record<string, unknown>;
  return (
    typeof stats.total === "number" &&
    typeof stats.solo === "number" &&
    typeof stats.groups === "number"
  );
}

// --- Login (OTP) modal — same flow as before, restyled for the light theme ---

function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sentNote, setSentNote] = useState("");
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Reset the flow whenever the modal opens or closes.
  useEffect(() => {
    if (isOpen) {
      setStep("email");
      setEmail("");
      setName("");
      setCode("");
      setError("");
      setSentNote("");
      setDevCode("");
      setLoading(false);
      setResendIn(0);
    }
  }, [isOpen]);

  // Countdown for the resend button (mirrors the server's 60s cooldown).
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  // Close on Escape; lock background scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const handleRequestCode = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await requestCode(email, name);
    setLoading(false);
    if (result.success) {
      setStep("code");
      setSentNote(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
      setDevCode(result.devCode || "");
      setResendIn(60);
    } else {
      setError(result.error || "Could not send a verification code.");
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError("");
    const result = await requestCode(email);
    if (result.success) {
      setDevCode(result.devCode || "");
      setResendIn(60);
      setSentNote(`A new code was sent to ${email}.`);
    } else {
      setError(result.error || "Could not resend the code.");
    }
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await verifyCode(email, code);
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || "Verification failed.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.button
            type="button"
            aria-label="Close login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-ink/40"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="card relative w-full max-w-md rounded-b-none p-8 sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-background hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            {step === "email" ? (
              <>
                <h2 className="font-display text-2xl font-bold text-ink">Welcome to Caplink</h2>
                <p className="mt-2 mb-6 text-sm text-muted">
                  Sign in with your university email — we&apos;ll send you a one-time code. No password
                  needed.
                </p>

                <form onSubmit={handleRequestCode} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="login-email" className="label">
                      University Email
                    </label>
                    <input
                      id="login-email"
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input w-full px-4 py-2.5"
                      placeholder="2024-1-12-345@std.ewubd.edu"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="login-name" className="label">
                      Full Name <span className="font-medium text-muted">(optional)</span>
                    </label>
                    <input
                      id="login-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input w-full px-4 py-2.5"
                      placeholder="John Doe"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                    {loading ? "Sending code..." : "Send Code"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold text-ink">Check your inbox</h2>
                <p className="mt-2 mb-6 text-sm text-muted">{sentNote}</p>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="login-code" className="label">
                      Verification Code
                    </label>
                    <input
                      id="login-code"
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="input w-full px-4 py-3 text-center text-xl font-bold tracking-[0.5em]"
                      placeholder="······"
                      autoFocus
                    />
                  </div>

                  {import.meta.env.DEV && devCode && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-mono text-[11px] text-amber-800">
                      DEV ONLY — your code: {devCode}
                    </p>
                  )}

                  {error && (
                    <p role="alert" className="text-xs font-medium text-red-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="btn-primary w-full py-3"
                  >
                    {loading ? "Verifying..." : "Verify & Sign In"}
                  </button>
                </form>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError("");
                    }}
                    className="text-muted transition hover:text-ink"
                  >
                    ← Wrong email?
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResend()}
                    disabled={resendIn > 0}
                    className="font-semibold text-primary transition hover:underline disabled:text-muted disabled:no-underline"
                  >
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
              </>
            )}

            <p className="mt-6 text-center text-[10px] uppercase leading-relaxed tracking-widest text-muted">
              Only verified university accounts <br /> (std.ewubd.edu / ewu.edu.bd) can participate.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Post Listing form — same fields and endpoint, restyled, inline errors ---

function PostForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    type: "solo" as "solo" | "group",
    name: user?.name || "",
    course: "",
    major: MAJORS[0],
    project_idea: "",
    skills: [] as string[],
    slots_open: 1,
    email: user?.email || "",
    facebook: "",
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          slots_open: formData.type === "group" ? formData.slots_open : null,
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractError(data, "Failed to post listing."));
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error posting listing.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  return (
    <div className="card mx-auto max-w-2xl p-6 sm:p-8">
      <h2 className="font-display text-2xl font-bold text-ink">Post Your Listing</h2>
      <p className="mt-1 text-sm text-muted">
        Tell other students what you want to build and who you&apos;re looking for.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="flex rounded-xl border border-border bg-background p-1" role="group" aria-label="Listing type">
          <button
            type="button"
            aria-pressed={formData.type === "solo"}
            onClick={() => setFormData({ ...formData, type: "solo" })}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition",
              formData.type === "solo" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            I&apos;m looking for a group
          </button>
          <button
            type="button"
            aria-pressed={formData.type === "group"}
            onClick={() => setFormData({ ...formData, type: "group" })}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition",
              formData.type === "group" ? "bg-primary text-white shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            My group needs members
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="post-name" className="label">
              Full Name
            </label>
            <input
              id="post-name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input w-full px-4 py-2.5"
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="post-course" className="label">
              Course &amp; Year
            </label>
            <input
              id="post-course"
              required
              value={formData.course}
              onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              className="input w-full px-4 py-2.5"
              placeholder="BSCS 3-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="post-major" className="label">
              Major
            </label>
            <select
              id="post-major"
              value={formData.major}
              onChange={(e) => setFormData({ ...formData, major: e.target.value })}
              className="input w-full px-4 py-2.5"
            >
              {MAJORS.map((major) => (
                <option key={major} value={major}>
                  {major}
                </option>
              ))}
            </select>
          </div>
          {formData.type === "group" && (
            <div className="space-y-1.5">
              <label htmlFor="post-slots" className="label">
                Slots Open
              </label>
              <input
                id="post-slots"
                type="number"
                min="1"
                max="10"
                value={formData.slots_open}
                onChange={(e) =>
                  setFormData({ ...formData, slots_open: Number.parseInt(e.target.value, 10) || 1 })
                }
                className="input w-full px-4 py-2.5"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="post-idea" className="label">
            Project Idea / Description
          </label>
          <textarea
            id="post-idea"
            required
            value={formData.project_idea}
            onChange={(e) => setFormData({ ...formData, project_idea: e.target.value })}
            className="input h-24 w-full resize-none px-4 py-2.5"
            placeholder="Describe your project vision or what you're looking for..."
          />
        </div>

        <div className="space-y-1.5">
          <span className="label" id="post-skills-label">
            Skills (select multiple)
          </span>
          <div className="flex flex-wrap gap-2" aria-labelledby="post-skills-label">
            {SKILLS.map((skill) => {
              const selected = formData.skills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSkill(skill)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    selected
                      ? "border-primary bg-lavender text-primary"
                      : "border-border bg-surface text-muted hover:border-primary/40"
                  )}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="post-email" className="label">
              Contact Email
            </label>
            <input
              id="post-email"
              required
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input w-full px-4 py-2.5"
            />
            <p className="text-[11px] text-muted">
              Only logged-in EWU students can see your contact details.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="post-facebook" className="label">
              Facebook / Social (optional)
            </label>
            <input
              id="post-facebook"
              value={formData.facebook}
              onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
              className="input w-full px-4 py-2.5"
              placeholder="fb.com/username"
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 py-3">
            {loading ? "Posting..." : "Post Listing"}
          </button>
        </div>
      </form>
    </div>
  );
}

// --- Gated-view prompt (only reachable if the session disappears mid-navigation) ---

function LoginRequired({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="card mx-auto max-w-md p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-lavender text-primary">
        <Lock className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-lg font-bold text-ink">Log in required</h2>
      <p className="mt-1.5 text-sm text-muted">Log in with your EWU email to continue.</p>
      <button type="button" onClick={onLoginClick} className="btn-primary mt-6">
        Log in
      </button>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<AppView>("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState<ListingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listingsRes, statsRes] = await Promise.all([
        fetch("/api/listings"),
        fetch("/api/stats"),
      ]);
      const listingsData: unknown = await listingsRes.json().catch(() => null);
      if (!listingsRes.ok) {
        throw new Error(extractError(listingsData, "Could not load listings. Please try again."));
      }
      if (!Array.isArray(listingsData)) {
        throw new Error("Unexpected response while loading listings.");
      }
      setListings(listingsData as Listing[]);

      // Stats are decorative; a failure here must not blank the feed.
      const statsData: unknown = await statsRes.json().catch(() => null);
      setStats(statsRes.ok && isStats(statsData) ? statsData : null);
    } catch (err) {
      setListings([]);
      setStats(null);
      setError(err instanceof Error ? err.message : "Something went wrong while loading listings.");
    } finally {
      setLoading(false);
    }
  };

  // Refetch when the session changes: a valid session unlocks contact info.
  useEffect(() => {
    void fetchData();
  }, [user]);

  const handleNavigate = (next: AppView) => {
    if ((next === "post" || next === "profile") && !user) {
      setLoginOpen(true);
      return;
    }
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const handleLogout = async () => {
    await logout();
    setView("browse");
  };

  const sharedNavProps = {
    view,
    onNavigate: handleNavigate,
    user,
    onLoginClick: () => setLoginOpen(true),
    onLogout: () => void handleLogout(),
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen">
        <Sidebar {...sharedNavProps} />
        <MobileNav {...sharedNavProps} />

        <main className="lg:pl-60">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {view === "browse" && (
              <ExplorePage
                listings={listings}
                stats={stats}
                loading={loading}
                error={error}
                onRetry={() => void fetchData()}
                user={user}
                onLoginClick={() => setLoginOpen(true)}
                onCreateClick={() => handleNavigate("post")}
              />
            )}

            {view === "post" &&
              (user ? (
                <PostForm
                  onSuccess={() => {
                    void fetchData();
                    setView("profile");
                    window.scrollTo({ top: 0 });
                  }}
                  onCancel={() => {
                    setView("browse");
                    window.scrollTo({ top: 0 });
                  }}
                />
              ) : (
                <LoginRequired onLoginClick={() => setLoginOpen(true)} />
              ))}

            {view === "profile" &&
              (user ? (
                <MyListingsPage
                  user={user}
                  onCreateClick={() => handleNavigate("post")}
                  onLoginClick={() => setLoginOpen(true)}
                />
              ) : (
                <LoginRequired onLoginClick={() => setLoginOpen(true)} />
              ))}
          </div>
        </main>

        <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    </MotionConfig>
  );
}
