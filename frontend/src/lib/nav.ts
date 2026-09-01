import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  CalendarRange,
  GraduationCap,
  UsersRound,
  ClipboardCheck,
  Wallet,
  BookOpenCheck,
  UserCog,
  Megaphone,
  BarChart3,
  Library,
  Bus,
  BedDouble,
  Banknote,
  Users2,
  FileBadge,
  CalendarClock,
  ShieldCheck,
  Crown,
  UserPlus,
  Sparkles,
  Boxes,
  CalendarCheck,
  Lightbulb,
  BookOpen,
  MessageCircle,
} from 'lucide-react';
import type { Role } from '@/types';

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// The sidebar used to be one flat list of ~25 links, which made it hard to
// scan. Grouped here into related sections instead - the groups are purely
// a navigation/display concern, so every route, role gate, and page is
// unchanged; this only changes how links are organized in the sidebar.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        to: '/',
        icon: LayoutDashboard,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST'],
      },
      {
        label: 'Platform',
        to: '/platform',
        icon: Crown,
        roles: ['CHAIRMAN'],
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        label: 'Schools & Branches',
        to: '/schools',
        icon: Building2,
        roles: ['DIRECTOR', 'ADMIN'],
      },
      {
        label: 'Academics',
        to: '/academics',
        icon: CalendarRange,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
      },
      {
        label: 'Students',
        to: '/students',
        icon: GraduationCap,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
      },
      {
        label: 'Admissions',
        to: '/admissions',
        icon: UserPlus,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST'],
      },
      {
        label: 'Teachers',
        to: '/teachers',
        icon: UsersRound,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR'],
      },
      {
        label: 'Attendance',
        to: '/attendance',
        icon: ClipboardCheck,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STUDENT'],
      },
      {
        label: 'Exams & Results',
        to: '/exams',
        icon: BookOpenCheck,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STUDENT'],
      },
    ],
  },
  {
    label: 'Finance & Resources',
    items: [
      {
        label: 'Finance',
        to: '/finance',
        icon: Wallet,
        roles: ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'],
      },
      {
        label: 'Payroll',
        to: '/payroll',
        icon: Banknote,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'TEACHER', 'COORDINATOR', 'LIBRARIAN', 'RECEPTIONIST'],
      },
      {
        label: 'Inventory & Assets',
        to: '/inventory',
        icon: Boxes,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT'],
      },
      {
        label: 'Library',
        to: '/library',
        icon: Library,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STUDENT', 'ACCOUNTANT'],
      },
      {
        label: 'Transport',
        to: '/transport',
        icon: Bus,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT'],
      },
      {
        label: 'Hostel',
        to: '/hostel',
        icon: BedDouble,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'STUDENT'],
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        label: 'Announcements',
        to: '/announcements',
        icon: Megaphone,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'ACCOUNTANT'],
      },
      {
        label: 'Chat',
        to: '/chat',
        icon: MessageCircle,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST'],
      },
      {
        label: 'Meetings & Tasks',
        to: '/meetings-tasks',
        icon: CalendarCheck,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST'],
      },
      {
        label: 'Suggestions Box',
        to: '/suggestions',
        icon: Lightbulb,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST'],
      },
    ],
  },
  {
    label: 'People & Reports',
    items: [
      {
        label: 'Parent Portal',
        to: '/parents',
        icon: Users2,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'PARENT'],
      },
      {
        label: 'Staff & Users',
        to: '/users',
        icon: UserCog,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL'],
      },
      {
        label: 'Reports',
        to: '/reports',
        icon: BarChart3,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
      },
      {
        label: 'Documents',
        to: '/documents',
        icon: FileBadge,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'RECEPTIONIST', 'STUDENT', 'TEACHER'],
      },
      {
        label: 'Schedule',
        to: '/schedule',
        icon: CalendarClock,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST'],
      },
    ],
  },
  {
    label: 'Tools',
    items: [
      {
        label: 'AI Tools',
        to: '/ai-tools',
        icon: Sparkles,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
      },
      {
        label: 'Manuals & SOPs',
        to: '/manuals',
        icon: BookOpen,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT', 'LIBRARIAN', 'RECEPTIONIST'],
      },
      {
        label: 'Admin Tools',
        to: '/admin-tools',
        icon: ShieldCheck,
        roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL'],
      },
    ],
  },
];

// Flat list kept for consumers that just need "all nav items" (e.g.
// AppShell's page-title lookup by current route) - derived from the groups
// above so there is exactly one place that defines a nav entry.
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
