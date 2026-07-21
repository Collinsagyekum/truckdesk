import { Outlet } from 'react-router-dom';
import BottomNav from '../ui/BottomNav';

export default function DriverLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-navy-900 text-white">
      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 pt-4">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}
