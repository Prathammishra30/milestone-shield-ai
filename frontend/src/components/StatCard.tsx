import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  subtitle?: string;
  accent?: 'forest' | 'ochre' | 'slate' | 'neutral';
}

const accentColors = {
  forest: 'text-[#1E4334]',
  ochre: 'text-[#915416]',
  slate: 'text-[#2C4A5C]',
  neutral: 'text-[#1B211D]',
};

export default function StatCard({ label, value, icon, subtitle, accent = 'neutral' }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface p-5 transition-shadow hover:shadow-xs">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-600">{label}</p>
          <p className={`mt-2 font-editorial text-2xl font-bold tracking-tight ${accentColors[accent]}`}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-ink-500">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="rounded border border-border-subtle bg-canvas-subtle p-2 text-ink-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
