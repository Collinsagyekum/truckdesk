import { Home, Truck, Receipt, Shield, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/driver/home', icon: Home, label: 'Home' },
  { to: '/driver/loads', icon: Truck, label: 'Loads' },
  { to: '/driver/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/driver/compliance', icon: Shield, label: 'Compliance' },
  { to: '/driver/financial', icon: Menu, label: 'More' },
];

export default function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    // If exact match or nested route
    if (path === '/driver/home') {
      return location.pathname === '/driver/home';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-navy-800 border-t border-white/10 z-50">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
                active
                  ? 'text-brand-green'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-sans">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
