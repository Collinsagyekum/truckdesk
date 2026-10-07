import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, LogOut, Trash2, Sun, Moon, Monitor } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../hooks/useTheme';
import type { ThemePreference } from '../context/ThemeContext';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Monitor }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

const DELETED_DATA = [
  'Your profile and sign-in',
  'Loads, invoices and rate history',
  'Expenses, receipt photos and fuel records',
  'Compliance documents and scans',
  'Trucks, mileage, maintenance, tax and retirement records',
  'Records of what you sent to MilesBot',
];

export default function AccountPage() {
  const { realUser, isImpersonating, signOut, deleteAccount } = useAuth();
  const { showSuccess, showError } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await deleteAccount();
    if (error) {
      setDeleting(false);
      showError(error.message);
      return;
    }
    showSuccess('Your account has been deleted.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-10">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-sans">Account</h1>

      <section className="bg-navy-800 border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-sans">
            Signed in as
          </p>
          <p className="text-base font-semibold text-white mt-1 truncate">{realUser?.full_name}</p>
          <p className="text-sm text-gray-400 truncate">{realUser?.email ?? realUser?.phone}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </section>

      <section className="bg-navy-800 border border-white/5 rounded-2xl p-5 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white font-sans">Appearance</h2>
          <p className="text-sm text-gray-400 mt-1">Choose how TruckDesk looks. "System" follows your phone.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                aria-pressed={active}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                  active
                    ? 'border-brand-green bg-brand-green/15 text-brand-green'
                    : 'border-white/10 text-gray-400 hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="bg-navy-800 border border-brand-red/20 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white font-sans">Delete account</h2>
          <p className="text-sm text-gray-400 mt-1">
            Permanently deletes your TruckDesk account and everything saved in it. This can't be undone.
          </p>
        </div>

        {isImpersonating ? (
          <p className="text-sm text-brand-amber">
            You're viewing the app as a driver. Stop viewing as a driver to delete your own account.
          </p>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-brand-red/40 text-sm font-semibold text-brand-red hover:bg-brand-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete account
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-brand-red">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>This permanently deletes:</p>
            </div>
            <ul className="list-disc pl-6 space-y-1 text-sm text-gray-300">
              {DELETED_DATA.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-red text-[#fff] text-sm font-bold hover:bg-brand-red/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white transition-colors"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete my account'
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-semibold text-gray-200 hover:bg-white/5 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
