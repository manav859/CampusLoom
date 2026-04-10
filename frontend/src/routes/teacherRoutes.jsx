import TeacherDashboardPage from '@/features/teacher/pages/TeacherDashboardPage';
import ProfilePage from '@/features/teacher/pages/ProfilePage';
import VideoLecturesPage from '@/features/teacher/pages/VideoLecturesPage';
import StudyMaterialPage from '@/features/teacher/pages/StudyMaterialPage';
import ChatWithStudentPage from '@/features/teacher/pages/ChatWithStudentPage';
import AttendancePage from '@/features/teacher/pages/AttendancePage';
import NotificationsPage from '@/features/teacher/pages/NotificationsPage';
import AlertPage from '@/features/teacher/pages/AlertPage';
import LibraryPage from '@/features/teacher/pages/LibraryPage';
import TimetablePage from '@/features/teacher/pages/TimetablePage';
import TestsPage from '@/features/teacher/pages/TestsPage';
import TransportPage from '@/features/teacher/pages/TransportPage';
import HostelPage from '@/features/teacher/pages/HostelPage';
import GalleryPage from '@/features/teacher/pages/GalleryPage';
import SalaryPage from '@/features/teacher/pages/SalaryPage';
import ChangePasswordPage from '@/features/teacher/pages/ChangePasswordPage';
import ExamTimetablePage from '@/features/teacher/pages/ExamTimetablePage';
import SyllabusPage from '@/features/teacher/pages/SyllabusPage';

const teacherRoutes = [
  { index: true, element: <TeacherDashboardPage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'lectures', element: <VideoLecturesPage /> },
  { path: 'material', element: <StudyMaterialPage /> },
  { path: 'chat', element: <ChatWithStudentPage /> },
  { path: 'attendance', element: <AttendancePage /> },
  { path: 'notifications', element: <NotificationsPage /> },
  { path: 'alert', element: <AlertPage /> },
  { path: 'library', element: <LibraryPage /> },
  { path: 'timetable', element: <TimetablePage /> },
  { path: 'tests', element: <TestsPage /> },
  { path: 'transport', element: <TransportPage /> },
  { path: 'hostel', element: <HostelPage /> },
  { path: 'gallery', element: <GalleryPage /> },
  { path: 'salary', element: <SalaryPage /> },
  { path: 'change-password', element: <ChangePasswordPage /> },
  { path: 'exam-timetable', element: <ExamTimetablePage /> },
  { path: 'syllabus', element: <SyllabusPage /> },
];

export default teacherRoutes;
