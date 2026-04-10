import { useState } from 'react';
import { GraduationCap, Users, Trash2 } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StudentsTable from '@/features/students/components/StudentsTable';
import { useAdminStudents } from '@/features/students/hooks/useAdminStudents';
import { deleteAdminStudent } from '@/features/students/api';
import { getErrorMessage } from '@/lib/api';

export default function StudentsPage() {
  const { data, error, isError, isLoading, refetch } = useAdminStudents();
  const [deleteError, setDeleteError] = useState('');
  const students = Array.isArray(data) ? data : [];

  const uniqueClasses = [...new Set(students.map((s) => s.class))];

  async function handleDelete(studentId) {
    const confirmed = window.confirm('Are you sure you want to delete this student? This action cannot be undone.');

    if (!confirmed) return;

    try {
      setDeleteError('');
      await deleteAdminStudent(studentId);
      refetch();
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Failed to delete student'));
    }
  }

  if (isLoading) {
    return <Loading title="Loading students" description="Preparing the student roster." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Students unavailable"
        message={getErrorMessage(error)}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Student Management</p>
        <h1 className="text-3xl font-black tracking-tight">Enrolled Students</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Students are created automatically when an admission inquiry is approved. Manage the student roster, view contact details, and access result entry from here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Total students</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tracking-tight">{students.length}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Classes</CardTitle>
            <GraduationCap className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black tracking-tight">{uniqueClasses.length}</p>
          </CardContent>
        </Card>
      </div>

      {deleteError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {students.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students enrolled yet"
          description="Students are created automatically when you approve an admission inquiry. Head over to the admissions page to get started."
        />
      ) : (
        <StudentsTable students={students} onDelete={handleDelete} />
      )}
    </section>
  );
}
