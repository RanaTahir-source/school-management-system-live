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

export const NAV_ITEMS: NavItem[] = [
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
    label: 'Finance',
    to: '/finance',
    icon: Wallet,
    roles: ['DIRECTOR', 'ADMIN', 'ACCOUNTANT', 'PRINCIPAL'],
  },
  {
    label: 'AI Tools',
    to: '/ai-tools',
    icon: Sparkles,
    roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
  },
  {
    label: 'Exams & Results',
    to: '/exams',
    icon: BookOpenCheck,
    roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'STUDENT'],
  },
  {
    label: 'Announcements',
    to: '/announcements',
    icon: Megaphone,
    roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER', 'ACCOUNTANT'],
  },
  {
    label: 'Reports',
    to: '/reports',
    icon: BarChart3,
    roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'COORDINATOR', 'TEACHER'],
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
  {
    label: 'Inventory & Assets',
    to: '/inventory',
    icon: Boxes,
    roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT'],
  },
  {
    label: 'Payroll',
    to: '/payroll',
    icon: Banknote,
    roles: ['DIRECTOR', 'ADMIN', 'PRINCIPAL', 'ACCOUNTANT', 'TEACHER', 'COORDINATOR', 'LIBRARIAN', 'RECEPTIONIST'],
  },
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
];
