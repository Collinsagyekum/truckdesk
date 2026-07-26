import { useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// Shown app-wide while an owner is viewing the app as a driver. The underlying
// Supabase session is still the owner's — this is a view overlay, not a re-login.
export default function ImpersonationBanner() {
  const { isImpersonating, user, stopImpersonating } = useAuth();
  const navigate = useNavigate();

  if (!isImpersonating) return null;

  const exit = () => {
    stopImpersonating();
    navigate('/owner/dashboard');
  };

  return (
    <div className="sticky top-0 z-50 bg-brand-amber text-navy-900 px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold">
      <Eye className="w-4 h-4 shrink-0" />
      <span className="truncate">
        Viewing as driver: {user?.full_name || 'driver'} (admin preview)
      </span>
      <button
        onClick={exit}
        className="inline-flex items-center gap-1 bg-navy-900/15 hover:bg-navy-900/25 transition-colors rounded-lg px-2.5 py-1"
      >
        <X className="w-3.5 h-3.5" /> Exit to owner
      </button>
    </div>
  );
}
