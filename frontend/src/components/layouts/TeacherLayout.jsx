import {
  LayoutDashboard,
  UserCircle,
  Video,
  BookOpen,
  MessageSquare,
  CalendarCheck,
  Bell,
  AlertTriangle,
  Library,
  CalendarDays,
  ClipboardList,
  Bus,
  Building,
  Image as ImageIcon,
  Banknote,
  Key,
  CalendarClock,
  BookText,
} from 'lucide-react';
import PortalLayout from './PortalLayout';

const TEACHER_SIDEBAR_LINKS = [
  { label: 'Dashboard', path: '/teacher', icon: LayoutDashboard, end: true },
  { label: 'Profile', path: '/teacher/profile', icon: UserCircle },
  { label: 'Video Lectures', path: '/teacher/lectures', icon: Video },
  { label: 'Study Material', path: '/teacher/material', icon: BookOpen },
  { label: 'Chat with Student', path: '/teacher/chat', icon: MessageSquare },
  { label: 'Attendance', path: '/teacher/attendance', icon: CalendarCheck },
  { label: 'Notifications', path: '/teacher/notifications', icon: Bell },
  { label: 'Alert', path: '/teacher/alert', icon: AlertTriangle },
  { label: 'Library', path: '/teacher/library', icon: Library },
  { label: 'Personal Timetable', path: '/teacher/timetable', icon: CalendarDays },
  { label: 'Test', path: '/teacher/tests', icon: ClipboardList },
  { label: 'Transport', path: '/teacher/transport', icon: Bus },
  { label: 'Hostel', path: '/teacher/hostel', icon: Building },
  { label: 'Gallery', path: '/teacher/gallery', icon: ImageIcon },
  { label: 'Salary', path: '/teacher/salary', icon: Banknote },
  { label: 'Exam Timetable', path: '/teacher/exam-timetable', icon: CalendarClock },
  { label: 'Syllabus', path: '/teacher/syllabus', icon: BookText },
  { label: 'Change Password', path: '/teacher/change-password', icon: Key },
];

export default function TeacherLayout() {
  return (
    <PortalLayout 
      sidebarLinks={TEACHER_SIDEBAR_LINKS} 
      portalPathLabel="Teacher Portal" 
    />
  );
}
