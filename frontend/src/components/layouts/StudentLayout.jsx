import {
  LayoutDashboard,
  UserCircle,
  Video,
  BookOpen,
  MessageSquare,
  CalendarCheck,
  Bell,
  Library,
  CalendarDays,
  ClipboardList,
  Bus,
  Building,
  Image as ImageIcon,
  Users,
  CreditCard,
  Key,
  CalendarClock,
  BookText,
} from 'lucide-react';
import PortalLayout from './PortalLayout';

const STUDENT_SIDEBAR_LINKS = [
  { label: 'Dashboard', path: '/account', icon: LayoutDashboard, end: true },
  { label: 'Profile', path: '/account/profile', icon: UserCircle },
  { label: 'Video Lectures', path: '/account/lectures', icon: Video },
  { label: 'Study Material', path: '/account/material', icon: BookOpen },
  { label: 'Chat', path: '/account/chat', icon: MessageSquare },
  { label: 'Attendance', path: '/account/attendance', icon: CalendarCheck },
  { label: 'Notifications', path: '/account/notifications', icon: Bell },
  { label: 'Library', path: '/account/library', icon: Library },
  { label: 'Timetable', path: '/account/timetable', icon: CalendarDays },
  { label: 'Test', path: '/account/tests', icon: ClipboardList },
  { label: 'Transport', path: '/account/transport', icon: Bus },
  { label: 'Hostel', path: '/account/hostel', icon: Building },
  { label: 'Gallery', path: '/account/gallery', icon: ImageIcon },
  { label: 'Faculty', path: '/account/faculty', icon: Users },
  { label: 'Fee', path: '/account/fees', icon: CreditCard },
  { label: 'Exam Timetable', path: '/account/exam-timetable', icon: CalendarClock },
  { label: 'Syllabus', path: '/account/syllabus', icon: BookText },
  { label: 'Change Password', path: '/account/change-password', icon: Key },
];

export default function StudentLayout() {
  return (
    <PortalLayout 
      sidebarLinks={STUDENT_SIDEBAR_LINKS} 
      portalPathLabel="Student Portal" 
    />
  );
}
