const statusMeta = {
  new: {
    label: 'New',
    className: 'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
  },
  in_review: {
    label: 'In Review',
    className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-100 text-rose-800 ring-1 ring-rose-200',
  },
};

export function formatAdmissionDate(value, options = {}) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  }).format(date);
}

export function getAdmissionStatusMeta(status) {
  return statusMeta[status] ?? {
    label: 'Unknown',
    className: 'bg-muted text-muted-foreground ring-1 ring-border',
  };
}

export function getAdmissionInquiryDefaults() {
  return {
    name: '',
    phone: '',
    email: '',
    classLevel: '',
    message: '',
  };
}

export function toAdmissionInquiryPayload(values) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    email: values.email.trim().toLowerCase(),
    class: values.classLevel.trim(),
    message: values.message?.trim() || undefined,
  };
}

export function getAdmissionStats(admissions) {
  const items = Array.isArray(admissions) ? admissions : [];

  return {
    total: items.length,
    new: items.filter((admission) => admission.status === 'new').length,
    inReview: items.filter((admission) => admission.status === 'in_review').length,
    approved: items.filter((admission) => admission.status === 'approved').length,
    rejected: items.filter((admission) => admission.status === 'rejected').length,
  };
}

export function filterAdmissionsByStatus(admissions, status) {
  if (!status || status === 'all') {
    return admissions;
  }

  return admissions.filter((admission) => admission.status === status);
}
