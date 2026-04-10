import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, BookOpen } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import Loading from '@/components/common/Loading';
import ResultEntryForm from '@/features/results/components/ResultEntryForm';
import ResultsTable from '@/features/results/components/ResultsTable';
import { useAdminStudents } from '@/features/students/hooks/useAdminStudents';
import { useStudentResults } from '@/features/results/hooks/useStudentResults';
import { getErrorMessage } from '@/lib/api';

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const initialStudentId = searchParams.get('student') || '';
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId);

  const {
    data: students,
    isLoading: studentsLoading,
    isError: studentsError,
    error: studentsErr,
    refetch: refetchStudents,
  } = useAdminStudents();

  const {
    data: results,
    isLoading: resultsLoading,
    isError: resultsError,
    error: resultsErr,
    refetch: refetchResults,
  } = useStudentResults(selectedStudentId);

  const studentList = Array.isArray(students) ? students : [];
  const resultList = Array.isArray(results) ? results : [];

  if (studentsLoading) {
    return <Loading title="Loading results" description="Preparing the results management interface." />;
  }

  if (studentsError) {
    return (
      <ErrorState
        title="Results unavailable"
        message={getErrorMessage(studentsErr)}
        actionLabel="Retry"
        onAction={() => refetchStudents()}
      />
    );
  }

  const selectedStudent = studentList.find((s) => s.id === selectedStudentId);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Results Management</p>
        <h1 className="text-3xl font-black tracking-tight">Manage Student Results</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Add exam results for enrolled students and review their performance. Each subject and exam type combination is unique per student.
        </p>
      </div>

      <ResultEntryForm students={studentList} />

      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">View results</p>
          <h2 className="text-2xl font-black tracking-tight">Student Results</h2>
        </div>

        <div className="max-w-sm space-y-2">
          <label htmlFor="view-student-select" className="text-sm font-semibold">
            Select student to view results
          </label>
          <select
            id="view-student-select"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a student</option>
            {studentList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.class}
              </option>
            ))}
          </select>
        </div>

        {!selectedStudentId ? (
          <EmptyState
            icon={ClipboardList}
            title="Select a student"
            description="Choose a student above to view their exam results."
          />
        ) : resultsLoading ? (
          <Loading title="Loading results" description={`Fetching results for ${selectedStudent?.name || 'student'}...`} />
        ) : resultsError ? (
          <ErrorState
            title="Results unavailable"
            message={getErrorMessage(resultsErr)}
            actionLabel="Retry"
            onAction={() => refetchResults()}
          />
        ) : resultList.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No results yet"
            description={`No exam results have been recorded for ${selectedStudent?.name || 'this student'} yet.`}
          />
        ) : (
          <ResultsTable results={resultList} />
        )}
      </div>
    </section>
  );
}
