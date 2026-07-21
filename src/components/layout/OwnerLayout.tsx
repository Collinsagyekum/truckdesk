import {
  LayoutDashboard,
  Truck,
  Users,
  Shield,
  FileText,
  LogOut,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const sidebarItems = [
  { to: '/owner/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/owner/fleet', icon: Truck, label: 'Fleet' },
  { to: '/owner/compliance', icon: Shield, label: 'Compliance' },
  { to: '/owner/invoices', icon: FileText, label: 'Invoices' },
];

export default function OwnerLayout() {
  const { signOut, user } = useAuth();

  return (
    <div className="flex min-h-screen bg-navy-900 text-white">
      {/* Left sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-64 bg-navy-800 border-r border-white/10">
        {/* Logo area */}
        <div className="flex items-center gap-2 h-16 px-6 border-b border-white/10">
          <Truck className="w-6 h-6 text-brand-green" />
          <span className="text-lg font-semibold tracking-tight">TruckDesk</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-green/10 text-brand-green'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User / Sign-out */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-green" />
            </div>
            <div className="truncate">
              <p className="text-sm font-medium truncate">
                {user?.full_name ?? 'Owner'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-brand-red transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 bg-navy-800 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-green" />
            <span className="font-semibold">TruckDesk</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
