import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { NAV_ITEMS } from '@/lib/nav';
export function AppShell() {
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const current = NAV_ITEMS.find((item) =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
                                 );
  return (
    <div className="flex h-screen w-full overflow-hidden bg-secondary/40">
    <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    <div className="flex min-w-0 flex-1 flex-col">
    <Topbar title={current?.label ?? 'Dashboard'} onMenuClick={() => setMobileNavOpen(true)} />
    <main className="flex-1 overflow-y-auto scrollbar-thin">
    <div className="mx-auto max-w-7xl px-6 py-6">
    <Outlet />
    </div>
    </main>
    </div>
    </div>
    );
}
