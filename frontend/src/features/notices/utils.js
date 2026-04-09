export function formatNoticeDate(value, options = {}) {
  if (!value) {
    return 'Not scheduled';
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

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

export function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

export function getNoticeFormDefaults(notice) {
  return {
    title: notice?.title ?? '',
    content: notice?.content ?? '',
    type: notice?.type ?? 'general',
    publishDate: toDateTimeLocalValue(notice?.publishDate ?? new Date()),
    expiryDate: toDateTimeLocalValue(notice?.expiryDate),
    isActive: notice?.isActive ?? true,
  };
}

export function toNoticePayload(values) {
  return {
    title: values.title.trim(),
    content: values.content.trim(),
    type: values.type,
    publishDate: new Date(values.publishDate).toISOString(),
    expiryDate: values.expiryDate ? new Date(values.expiryDate).toISOString() : null,
    isActive: values.isActive,
  };
}

export function getNoticeVisibilityState(notice, now = new Date()) {
  if (!notice?.isActive) {
    return {
      label: 'Inactive',
      className: 'bg-muted text-muted-foreground ring-1 ring-border',
    };
  }

  const publishDate = notice?.publishDate ? new Date(notice.publishDate) : null;
  const expiryDate = notice?.expiryDate ? new Date(notice.expiryDate) : null;

  if (publishDate && publishDate > now) {
    return {
      label: 'Scheduled',
      className: 'bg-secondary text-secondary-foreground ring-1 ring-border',
    };
  }

  if (expiryDate && expiryDate < now) {
    return {
      label: 'Expired',
      className: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    };
  }

  return {
    label: 'Live',
    className:
      notice?.type === 'urgent'
        ? 'bg-destructive/10 text-destructive ring-1 ring-destructive/20'
        : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
  };
}
