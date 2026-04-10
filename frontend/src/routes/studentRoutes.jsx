import StudentDashboardPage from '@/features/student/pages/StudentDashboardPage';
import ProfilePage from '@/features/student/pages/ProfilePage';
import VideoLecturesPage from '@/features/student/pages/VideoLecturesPage';
import StudyMaterialPage from '@/features/student/pages/StudyMaterialPage';
import AttendancePage from '@/features/student/pages/AttendancePage';
import NotificationsPage from '@/features/student/pages/NotificationsPage';
import LibraryPage from '@/features/student/pages/LibraryPage';
import TimetablePage from '@/features/student/pages/TimetablePage';
import TestsPage from '@/features/student/pages/TestsPage';
import TransportPage from '@/features/student/pages/TransportPage';
import HostelPage from '@/features/student/pages/HostelPage';
import GalleryPage from '@/features/student/pages/GalleryPage';
import FacultyPage from '@/features/student/pages/FacultyPage';
import FeePage from '@/features/student/pages/FeePage';
import ChangePasswordPage from '@/features/student/pages/ChangePasswordPage';
import ExamTimetablePage from '@/features/student/pages/ExamTimetablePage';
import SyllabusPage from '@/features/student/pages/SyllabusPage';
import ChatPage from '@/features/student/pages/ChatPage';

const studentRoutes = [
  { index: true, element: <StudentDashboardPage /> },
  { path: 'profile', element: <ProfilePage /> },
  { path: 'lectures', element: <VideoLecturesPage /> },
  { path: 'material', element: <StudyMaterialPage /> },
  { path: 'chat', element: <ChatPage /> },
  { path: 'attendance', element: <AttendancePage /> },
  { path: 'notifications', element: <NotificationsPage /> },
  { path: 'library', element: <LibraryPage /> },
  { path: 'timetable', element: <TimetablePage /> },
  { path: 'tests', element: <TestsPage /> },
  { path: 'transport', element: <TransportPage /> },
  { path: 'hostel', element: <HostelPage /> },
  { path: 'gallery', element: <GalleryPage /> },
  { path: 'faculty', element: <FacultyPage /> },
  { path: 'fees', element: <FeePage /> },
  { path: 'change-password', element: <ChangePasswordPage /> },
  { path: 'exam-timetable', element: <ExamTimetablePage /> },
  { path: 'syllabus', element: <SyllabusPage /> },
];

export default studentRoutes;
