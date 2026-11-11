import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Filter, Users, User as UserIcon, Lock, Mail, Facebook, Trash2, Plus, LogOut, ChevronDown, GraduationCap } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Listing, MAJORS, SKILLS, cn } from './types';

// --- Components ---

const LoginModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { requestCode, verifyCode } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [sentNote, setSentNote] = useState('');
  const [devCode, setDevCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Reset the flow whenever the modal opens or closes.
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setName('');
      setCode('');
      setError('');
      setSentNote('');
      setDevCode('');
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

  if (!isOpen) return null;

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await requestCode(email, name);
    setLoading(false);
    if (result.success) {
      setStep('code');
      setSentNote(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
      setDevCode(result.devCode || '');
      setResendIn(60);
    } else {
      setError(result.error || 'Could not send a verification code.');
    }
  };

  const handleResend = async () => {
    if (resendIn > 0) return;
    setError('');
    const result = await requestCode(email);
    if (result.success) {
      setDevCode(result.devCode || '');
      setResendIn(60);
      setSentNote(`A new code was sent to ${email}.`);
    } else {
      setError(result.error || 'Could not resend the code.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyCode(email, code);
    setLoading(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Verification failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md glass rounded-3xl p-8 shadow-2xl"
      >
        {step === 'email' ? (
          <>
            <h2 className="text-2xl font-display mb-2">Welcome to Caplink</h2>
            <p className="text-sm text-muted mb-6">Sign in with your university email — we'll send you a one-time code. No password needed.</p>

            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">University Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
                  placeholder="2024-1-12-345@std.ewubd.edu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Full Name <span className="text-[10px] normal-case font-medium">(optional)</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>

              {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

              <button
                disabled={loading}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? 'Sending code...' : 'Send Code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-display mb-2">Check your inbox</h2>
            <p className="text-sm text-muted mb-6">{sentNote}</p>

            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">Verification Code</label>
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-bold focus:border-primary outline-none transition-all"
                  placeholder="······"
                  autoFocus
                />
              </div>

              {import.meta.env.DEV && devCode && (
                <p className="text-[11px] text-amber-300/90 font-mono bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  DEV ONLY — your code: {devCode}
                </p>
              )}

              {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

              <button
                disabled={loading || code.length !== 6}
                className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setStep('email'); setError(''); }}
                className="text-muted hover:text-white transition-colors"
              >
                ← Wrong email?
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendIn > 0}
                className="text-primary hover:underline disabled:text-muted disabled:no-underline transition-all"
              >
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </>
        )}

        <p className="mt-6 text-[10px] text-center text-muted uppercase tracking-widest leading-relaxed">
          Only verified university accounts <br /> (std.ewubd.edu / ewu.edu.bd) can participate.
        </p>
      </motion.div>
    </div>
  );
};

const NavBar = ({ onPostClick, onProfileClick, onHomeClick, onLoginClick }: { onPostClick: () => void, onProfileClick: () => void, onHomeClick: () => void, onLoginClick: () => void }) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="sticky top-0 z-50 glass border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 cursor-pointer" onClick={onHomeClick}>
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <GraduationCap className="text-white w-5 h-5" />
        </div>
        <span className="font-display text-xl font-bold text-white">Caplink</span>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={onHomeClick} className="text-sm font-medium text-muted hover:text-white transition-colors">Browse</button>
        <button onClick={onPostClick} className="text-sm font-medium text-muted hover:text-white transition-colors">Post Listing</button>
        
        {user ? (
          <div className="relative">
            <button 
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-colors"
            >
              <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full border border-border" />
              <ChevronDown className={cn("w-4 h-4 text-muted transition-transform", showDropdown && "rotate-180")} />
            </button>
            <AnimatePresence>
              {showDropdown && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-48 glass rounded-xl shadow-2xl overflow-hidden"
                >
                  <button onClick={() => { onProfileClick(); setShowDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 flex items-center gap-2">
                    <UserIcon className="w-4 h-4" /> My Listings
                  </button>
                  <button onClick={() => { logout(); setShowDropdown(false); }} className="w-full px-4 py-3 text-left text-sm hover:bg-white/5 text-red-400 flex items-center gap-2">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <button 
            onClick={onLoginClick}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-primary/20"
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

const ListingCard: React.FC<{ listing: Listing, onDelete?: (id: string) => void, onLoginRequired: () => void }> = ({ listing, onDelete, onLoginRequired }) => {
  const { user } = useAuth();
  const skills = JSON.parse(listing.skills);
  const isNew = new Date().getTime() - new Date(listing.created_at).getTime() < 24 * 60 * 60 * 1000;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-gradient border border-border rounded-2xl p-6 flex flex-col gap-4 relative group"
    >
      <div className="flex justify-between items-start">
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
          listing.type === 'solo' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
        )}>
          {listing.type === 'solo' ? '👤 Looking for Group' : '👥 Group Needs Members'}
        </div>
        {isNew && <span className="bg-accent text-white text-[10px] px-2 py-0.5 rounded-full font-bold">NEW</span>}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white">{listing.name}</h3>
        <p className="text-sm text-muted">{listing.major} • {listing.course}</p>
      </div>

      <div className="pl-4 border-l-2 border-primary/30 italic text-sm text-slate-300 py-1">
        "{listing.project_idea}"
      </div>

      <div className="flex flex-wrap gap-2">
        {skills.map((skill: string) => (
          <span key={skill} className="px-2 py-1 bg-white/5 rounded-md text-[11px] text-muted border border-white/5">
            {skill}
          </span>
        ))}
      </div>

      {listing.type === 'group' && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
          <Users className="w-3.5 h-3.5" />
          {listing.slots_open} slots available
        </div>
      )}

      <div className="mt-auto pt-4 border-t border-border relative overflow-hidden rounded-xl">
        <div className={cn("flex flex-col gap-2 transition-all", listing.is_locked && "blur-sm select-none")}>
          <div className="flex items-center gap-2 text-sm text-muted">
            <Mail className="w-4 h-4" /> {listing.email || '••••••••@gmail.com'}
          </div>
          {listing.facebook && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Facebook className="w-4 h-4" /> {listing.facebook}
            </div>
          )}
        </div>

        {listing.is_locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/40 backdrop-blur-[2px] rounded-xl">
            <button 
              onClick={onLoginRequired}
              className="flex items-center gap-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg border border-white/10 transition-all"
            >
              <Lock className="w-3 h-3" /> Login to View Contact
            </button>
          </div>
        )}
      </div>

      {onDelete && (
        <button 
          onClick={() => onDelete(listing.id)}
          className="absolute top-4 right-4 p-2 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

const StatsBar = ({ stats }: { stats: { total: number, solo: number, groups: number } }) => {
  return (
    <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto mb-12">
      {[
        { label: 'Total Listings', value: stats.total, color: 'text-primary' },
        { label: 'Solo Students', value: stats.solo, color: 'text-indigo-400' },
        { label: 'Open Groups', value: stats.groups, color: 'text-emerald-400' },
      ].map((stat) => (
        <div key={stat.label} className="glass rounded-2xl p-4 text-center">
          <div className={cn("text-2xl font-display font-bold", stat.color)}>{stat.value}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted font-bold mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
};

const PostForm = ({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: 'solo' as 'solo' | 'group',
    name: user?.name || '',
    course: '',
    major: MAJORS[0],
    project_idea: '',
    skills: [] as string[],
    slots_open: 1,
    email: user?.email || '',
    facebook: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          slots_open: formData.type === 'group' ? formData.slots_open : null
        }),
      });
      if (res.ok) onSuccess();
      else alert('Failed to post listing');
    } catch (err) {
      alert('Error posting listing');
    } finally {
      setLoading(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) 
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto glass rounded-3xl p-8 shadow-2xl"
    >
      <h2 className="text-2xl font-display mb-6">Post Your Listing</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex p-1 bg-white/5 rounded-xl border border-border">
          <button 
            type="button"
            onClick={() => setFormData({ ...formData, type: 'solo' })}
            className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", formData.type === 'solo' ? "bg-primary text-white shadow-lg" : "text-muted hover:text-white")}
          >
            I'm looking for a group
          </button>
          <button 
            type="button"
            onClick={() => setFormData({ ...formData, type: 'group' })}
            className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", formData.type === 'group' ? "bg-primary text-white shadow-lg" : "text-muted hover:text-white")}
          >
            My group needs members
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Full Name</label>
            <input 
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Course & Year</label>
            <input 
              required
              value={formData.course}
              onChange={e => setFormData({ ...formData, course: e.target.value })}
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
              placeholder="BSCS 3-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Major</label>
            <select 
              value={formData.major}
              onChange={e => setFormData({ ...formData, major: e.target.value })}
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all appearance-none"
            >
              {MAJORS.map(m => <option key={m} value={m} className="bg-surface">{m}</option>)}
            </select>
          </div>
          {formData.type === 'group' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Slots Open</label>
              <input 
                type="number"
                min="1"
                max="10"
                value={formData.slots_open}
                onChange={e => setFormData({ ...formData, slots_open: parseInt(e.target.value) })}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Project Idea / Description</label>
          <textarea 
            required
            value={formData.project_idea}
            onChange={e => setFormData({ ...formData, project_idea: e.target.value })}
            className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all h-24 resize-none"
            placeholder="Describe your project vision or what you're looking for..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Skills (Select multiple)</label>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map(skill => (
              <button 
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  formData.skills.includes(skill) ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-border text-muted hover:border-white/20"
                )}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Contact Email</label>
            <input 
              required
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Facebook / Social (Optional)</label>
            <input 
              value={formData.facebook}
              onChange={e => setFormData({ ...formData, facebook: e.target.value })}
              className="w-full bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-all"
              placeholder="fb.com/username"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button 
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-bold text-muted hover:text-white transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={loading}
            className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Post Listing'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const { user } = useAuth();
  const [view, setView] = useState<'browse' | 'post' | 'profile'>('browse');
  const [listings, setListings] = useState<Listing[]>([]);
  const [stats, setStats] = useState({ total: 0, solo: 0, groups: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'solo' | 'group'>('all');
  const [majorFilter, setMajorFilter] = useState('All Majors');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [lRes, sRes] = await Promise.all([
        fetch('/api/listings'),
        fetch('/api/stats')
      ]);
      setListings(await lRes.json());
      setStats(await sRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const filteredListings = listings.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) || 
                          l.project_idea.toLowerCase().includes(search.toLowerCase()) ||
                          l.skills.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || l.type === typeFilter;
    const matchesMajor = majorFilter === 'All Majors' || l.major === majorFilter;
    return matchesSearch && matchesType && matchesMajor;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  return (
    <div className="min-h-screen pb-20">
      <NavBar 
        onPostClick={() => user ? setView('post') : setIsLoginModalOpen(true)} 
        onProfileClick={() => setView('profile')}
        onHomeClick={() => setView('browse')}
        onLoginClick={() => setIsLoginModalOpen(true)}
      />

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />

      <main className="max-w-7xl mx-auto px-6 pt-12">
        {view === 'browse' && (
          <>
            <div className="relative text-center mb-16 pt-12 pb-20 overflow-hidden rounded-[3rem]">
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-display mb-6 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent relative z-10"
              >
                Find your perfect <br /> capstone team.
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted text-lg max-w-2xl mx-auto mb-8"
              >
                Connect with fellow university students to build amazing things together. 
                Browse listings, share your ideas, and form the dream team.
              </motion.p>
              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => user ? setView('post') : setIsLoginModalOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Post Your Listing
                </button>
              </div>
            </div>

            <StatsBar stats={stats} />

            <div className="flex flex-col md:flex-row gap-4 mb-12">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted w-5 h-5" />
                <input 
                  type="text"
                  placeholder="Search by name, major, skill, or idea..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-surface border border-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary outline-none transition-all"
                />
              </div>
              <div className="flex gap-2 p-1 bg-surface border border-border rounded-2xl">
                {(['all', 'solo', 'group'] as const).map(t => (
                  <button 
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all",
                      typeFilter === t ? "bg-white/10 text-white" : "text-muted hover:text-white"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <select 
                value={majorFilter}
                onChange={e => setMajorFilter(e.target.value)}
                className="bg-surface border border-border rounded-2xl px-4 py-4 text-sm focus:border-primary outline-none transition-all appearance-none min-w-[200px]"
              >
                <option>All Majors</option>
                {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 glass rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredListings.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredListings.map(l => (
                  <ListingCard key={l.id} listing={l} onLoginRequired={() => setIsLoginModalOpen(true)} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 glass rounded-3xl">
                <Search className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
                <h3 className="text-xl font-display text-white mb-2">No listings found</h3>
                <p className="text-muted">Try adjusting your search or filters.</p>
              </div>
            )}
          </>
        )}

        {view === 'post' && (
          <PostForm 
            onSuccess={() => { setView('browse'); fetchData(); }} 
            onCancel={() => setView('browse')} 
          />
        )}

        {view === 'profile' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-display">My Listings</h2>
              <button onClick={() => setView('browse')} className="text-sm text-muted hover:text-white">Back to Browse</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {listings.filter(l => l.user_id === user?.id).map(l => (
                <ListingCard key={l.id} listing={l} onDelete={handleDelete} onLoginRequired={() => setIsLoginModalOpen(true)} />
              ))}
              {listings.filter(l => l.user_id === user?.id).length === 0 && (
                <div className="col-span-full py-20 text-center glass rounded-3xl">
                  <p className="text-muted mb-4">You haven't posted any listings yet.</p>
                  <button onClick={() => setView('post')} className="bg-primary px-6 py-2 rounded-xl text-sm font-bold">Create First Listing</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
