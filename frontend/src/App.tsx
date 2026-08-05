import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import StudentsPage from '@/pages/StudentsPage';
import TeachersPage from '@/pages/TeachersPage';
import SchoolsPage from '@/pages/SchoolsPage';
import AcademicsPage from '@/pages/AcademicsPage';
import AttendancePage from '@/pages/AttendancePage';
import FinancePage from '@/pages/FinancePage';
import ExamsPage from '@/pages/ExamsPage';
import StaffUsersPage from '@/pages/StaffUsersPage';
import AnnouncementsPage from '@/pages/AnnouncementsPage';
import ReportsPage from '@/pages/ReportsPage';
import LibraryPage from '@/pages/LibraryPage';
import TransportPage from '@/pages/TransportPage';
import HostelPage from '@/pages/HostelPage';
import PayrollPage from '@/pages/PayrollPage';
import ParentsPage from '@/pages/ParentsPage';
import DocumentsPage from '@/pages/DocumentsPage';
import SchedulePage from '@/pages/SchedulePage';
import AdminToolsPage from '@/pages/AdminToolsPage';
import PlatformPage from '@/pages/PlatformPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/schools" element={<SchoolsPage />} />
          <Route path="/academics" element={<AcademicsPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/exams" element={<ExamsPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/transport" element={<TransportPage />} />
          <Route path="/hostel" element={<HostelPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/parents" element={<ParentsPage />} />
          <Route path="/users" element={<StaffUsersPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/admin-tools" element={<AdminToolsPage />} />
          <Route path="/platform" element={<PlatformPage />} />
        </Route>
      </Route>

      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
