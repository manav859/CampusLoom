import { useNavigate } from 'react-router-dom';
import { Eye, Trash2, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatDate(dateString) {
  if (!dateString) return '—';

  return new Date(dateString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function StudentsTable({ students, onDelete }) {
  const navigate = useNavigate();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Student</th>
              <th className="px-5 py-4">Class</th>
              <th className="hidden px-5 py-4 md:table-cell">Contact</th>
              <th className="hidden px-5 py-4 lg:table-cell">Enrolled</th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {students.map((student) => (
              <tr key={student.id} className="align-top transition-colors hover:bg-muted/20">
                <td className="px-5 py-4">
                  <p className="font-semibold text-foreground">{student.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ID: {student.id.slice(-6).toUpperCase()}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-bold text-primary">
                    {student.class}
                  </span>
                </td>
                <td className="hidden px-5 py-4 md:table-cell">
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <a href={`mailto:${student.email}`} className="flex items-center gap-2 hover:text-foreground">
                      <Mail className="size-3.5" />
                      {student.email}
                    </a>
                    <a href={`tel:${student.phone}`} className="flex items-center gap-2 hover:text-foreground">
                      <Phone className="size-3.5" />
                      {student.phone}
                    </a>
                  </div>
                </td>
                <td className="hidden px-5 py-4 text-muted-foreground lg:table-cell">
                  {formatDate(student.createdAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-primary"
                      onClick={() => navigate(`/admin/results?student=${student.id}`)}
                      title="View results"
                    >
                      <Eye className="size-4" />
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDelete(student.id)}
                        title="Delete student"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
