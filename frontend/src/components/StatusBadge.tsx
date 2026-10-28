type BadgeVariant = 'forest' | 'ochre' | 'slate' | 'crimson' | 'bone' | 'neutral';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantClasses: Record<BadgeVariant, string> = {
  forest: 'bg-[#EAF2EE] text-[#1E4334] border-[#C7DDD1]',
  ochre: 'bg-[#FDF3E5] text-[#915416] border-[#F1D6B3]',
  slate: 'bg-[#ECF2F6] text-[#2C4A5C] border-[#CADCE6]',
  crimson: 'bg-[#FDE8E8] text-[#9B2C2C] border-[#F5C2C2]',
  bone: 'bg-[#F4EFE6] text-[#606B64] border-[#DFD8CC]',
  neutral: 'bg-[#F9F7F2] text-[#4F5953] border-[#E4DED4]',
};

export default function StatusBadge({ label, variant = 'neutral', size = 'sm' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded border font-medium tracking-tight ${sizeClasses} ${variantClasses[variant]}`}
    >
      {label}
    </span>
  );
}

// ── Helpers to map domain statuses to badge variants ──────────────

export function milestoneVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending: 'bone',
    in_progress: 'slate',
    submitted: 'ochre',
    approved: 'forest',
    rejected: 'crimson',
    paid: 'forest',
  };
  return map[status] ?? 'neutral';
}

export function submissionVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending_review: 'ochre',
    approved: 'forest',
    rejected: 'crimson',
    revision_requested: 'ochre',
    escalated: 'crimson',
  };
  return map[status] ?? 'neutral';
}

export function paymentVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    pending: 'bone',
    authorized: 'ochre',
    captured: 'forest',
    refunded: 'slate',
    voided: 'crimson',
  };
  return map[status] ?? 'neutral';
}

export function projectVariant(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: 'forest',
    completed: 'forest',
    paused: 'ochre',
    draft: 'bone',
  };
  return map[status] ?? 'neutral';
}
