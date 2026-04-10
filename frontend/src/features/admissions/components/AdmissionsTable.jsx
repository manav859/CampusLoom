import { Mail, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AdmissionStatusBadge from './AdmissionStatusBadge';
import { formatAdmissionDate } from '../utils';

export default function AdmissionsTable({ admissions }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Student</th>
              <th className="px-5 py-4">Class</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Submitted</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {admissions.map((admission) => (
              <tr key={admission.id} className="align-top transition-colors hover:bg-muted/20">
                <td className="px-5 py-4">
                  <div className="space-y-2">
                    <div>
                      <p className="font-semibold text-foreground">{admission.name}</p>
                      <p className="text-xs text-muted-foreground">Inquiry ID: {admission.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <a href={`tel:${admission.phone}`} className="inline-flex items-center gap-2 hover:text-foreground">
                        <Phone className="size-3.5" />
                        {admission.phone}
                      </a>
                      <a href={`mailto:${admission.email}`} className="flex items-center gap-2 hover:text-foreground">
                        <Mail className="size-3.5" />
                        {admission.email}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 font-medium">{admission.class}</td>
                <td className="px-5 py-4">
                  <AdmissionStatusBadge status={admission.status} />
                </td>
                <td className="px-5 py-4 text-muted-foreground">{formatAdmissionDate(admission.createdAt)}</td>
                <td className="px-5 py-4 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/admissions/${admission.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
