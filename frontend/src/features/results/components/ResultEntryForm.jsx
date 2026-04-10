import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { examTypeOptions } from '../api';
import { useCreateResult } from '../hooks/useCreateResult';
import { getErrorMessage } from '@/lib/api';

const initialFormState = {
  studentId: '',
  subject: '',
  marks: '',
  maxMarks: '',
  examType: '',
};

export default function ResultEntryForm({ students = [] }) {
  const [form, setForm] = useState(initialFormState);
  const [successMessage, setSuccessMessage] = useState('');
  const { mutate, isPending, error, isError, reset } = useCreateResult();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setSuccessMessage('');

    if (isError) {
      reset();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSuccessMessage('');

    const payload = {
      studentId: form.studentId,
      subject: form.subject.trim(),
      marks: Number(form.marks),
      maxMarks: Number(form.maxMarks),
      examType: form.examType,
    };

    mutate(payload, {
      onSuccess: () => {
        setForm(initialFormState);
        setSuccessMessage('Result added successfully!');
      },
    });
  }

  const isFormValid =
    form.studentId &&
    form.subject.trim() &&
    form.marks !== '' &&
    form.maxMarks !== '' &&
    form.examType;

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">Add Result</CardTitle>
        <CardDescription>
          Enter marks for a student. Each subject + exam type combination is unique per student.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="result-studentId" className="text-sm font-semibold">
                Student
              </label>
              <select
                id="result-studentId"
                name="studentId"
                value={form.studentId}
                onChange={handleChange}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">Select student</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.class}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="result-subject" className="text-sm font-semibold">
                Subject
              </label>
              <Input
                id="result-subject"
                name="subject"
                placeholder="e.g. Mathematics"
                value={form.subject}
                onChange={handleChange}
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="result-marks" className="text-sm font-semibold">
                Marks Obtained
              </label>
              <Input
                id="result-marks"
                name="marks"
                type="number"
                min="0"
                placeholder="e.g. 85"
                value={form.marks}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="result-maxMarks" className="text-sm font-semibold">
                Max Marks
              </label>
              <Input
                id="result-maxMarks"
                name="maxMarks"
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={form.maxMarks}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="result-examType" className="text-sm font-semibold">
                Exam Type
              </label>
              <select
                id="result-examType"
                name="examType"
                value={form.examType}
                onChange={handleChange}
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">Select exam type</option>
                {examTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {getErrorMessage(error, 'Failed to add result')}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm font-semibold text-green-700">
              {successMessage}
            </div>
          )}

          <Button type="submit" disabled={isPending || !isFormValid} className="w-full sm:w-auto">
            {isPending ? 'Saving...' : 'Add Result'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
