import { NavLink } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/nav';
import { useAuth } from '@/lib/auth';

// Branding shown here is per-tenant: the platform-wide Chairman account and
// the original Dar-e-Arqam campuses (Jandanwala/Rodi/Ali Khel - seeded with
// logoUrl='/logo.png') keep their real logo. Any newly onboarded school has
// no logoUrl until its own Director uploads one in Settings, so it falls
// back to a generic icon + its own school name - never someone else's brand.
const PLATFORM_BRAND = { name: 'Dar-e-Arqam', logoUrl: '/logo.png' };

export function Sidebar() {
  const { user, hasRole } = useAuth();
  const items = NAV_ITEMS.filter((item) => user && item.roles.some((r) => user.roles.includes(r)));

  const brand = hasRole('CHAIRMAN')
    ? PLATFORM_BRAND
    : { name: user?.school?.name || 'School Management System', logoUrl: user?.school?.logoUrl ?? null };

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={`${brand.name} logo`} className="h-full w-full object-contain" />
          ) : (
            <GraduationCap className="h-5 w-5 text-sidebar" />
          )}
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">{brand.name}</p>
          <p className="text-[11px] text-sidebar-foreground/60">School Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-thin">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white',
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4">
        <p className="text-[11px] text-sidebar-foreground/50">Milestone 1&ndash;5 &middot; v1.0</p>
      </div>
    </aside>
  );
}
