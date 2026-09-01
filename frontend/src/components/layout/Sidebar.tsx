import { NavLink } from 'react-router-dom';
import { GraduationCap, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/nav';
import { useAuth } from '@/lib/auth';
const PLATFORM_BRAND = { name: 'Dar-e-Arqam', logoUrl: '/logo.png' };
interface SidebarProps {
  open: boolean;
  onClose: () => void;
}
export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, hasRole } = useAuth();
  const items = NAV_ITEMS.filter((item) => user && item.roles.some((r) => user.roles.includes(r)));
  const brand = hasRole('CHAIRMAN')
  ? PLATFORM_BRAND
    : { name: user?.school?.name || 'School Management System', logoUrl: user?.school?.logoUrl ?? null };
  return [
    open ? (
      <div key="backdrop" className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      ) : null,
    <aside
      key="sidebar"
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 lg:flex',
        open && 'translate-x-0',
        )}
      >
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
    <button
      type="button"
      onClick={onClose}
      className="ml-auto rounded-md p-1 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white lg:hidden"
      aria-label="Close menu"
      >
    <X className="h-5 w-5" />
    </button>
    </div>
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onClose}
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
    ];
}
