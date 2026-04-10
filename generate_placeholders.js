const fs = require('fs');
const path = require('path');

const pages = [
  { name: 'ProfilePage', title: 'Profile' },
  { name: 'VideoLecturesPage', title: 'Video Lectures' },
  { name: 'StudyMaterialPage', title: 'Study Material' },
  { name: 'AttendancePage', title: 'Attendance' },
  { name: 'NotificationsPage', title: 'Notifications' },
  { name: 'LibraryPage', title: 'Library' },
  { name: 'TimetablePage', title: 'Timetable' },
  { name: 'TestsPage', title: 'Tests' },
  { name: 'TransportPage', title: 'Transport' },
  { name: 'HostelPage', title: 'Hostel' },
  { name: 'GalleryPage', title: 'Gallery' },
  { name: 'FacultyPage', title: 'Faculty' },
  { name: 'FeePage', title: 'Fee' },
  { name: 'ChangePasswordPage', title: 'Change Password' },
  { name: 'ExamTimetablePage', title: 'Exam Timetable' },
  { name: 'SyllabusPage', title: 'Syllabus' }
];

const dir = path.join(__dirname, 'frontend', 'src', 'features', 'student', 'pages');

pages.forEach(p => {
  const file = path.join(dir, `${p.name}.jsx`);
  const content = `import PlaceholderPage from '../components/PlaceholderPage';\n\nexport default function ${p.name}() {\n  return <PlaceholderPage title="${p.title}" />;\n}\n`;
  fs.writeFileSync(file, content);
});
console.log('Done generating placeholder pages.');
