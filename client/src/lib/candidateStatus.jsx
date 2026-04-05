// Derives the effective display status of an interview from its status + hr_review verdict.
// interviews.status tracks candidate submission state: pending | submitted
// hr_reviews.verdict tracks HR's decision: shortlisted | rejected | under_review
export function getStatus(interview) {
  const verdict = interview.hr_reviews?.[0]?.verdict
  if (verdict) return verdict
  return interview.status // 'pending' | 'submitted'
}

export const STATUS_META = {
  pending:      { label: 'Pending',      pill: 'bg-slate-100 text-slate-500 border-slate-200' },
  submitted:    { label: 'Submitted',    pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  shortlisted:  { label: 'Shortlisted',  pill: 'bg-green-50 text-green-700 border-green-200' },
  rejected:     { label: 'Rejected',     pill: 'bg-red-50 text-red-700 border-red-200' },
  under_review: { label: 'Under review', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export function StatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold
      border ${meta.pill} ${className}`}>
      {meta.label}
    </span>
  )
}

export function formatDateTime(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}
