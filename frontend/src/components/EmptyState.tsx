import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border-default bg-canvas-subtle/50 py-16 px-6 text-center">
      <div className="rounded-full border border-border-default bg-surface p-4 text-ink-500 shadow-2xs">
        {icon}
      </div>
      <h3 className="mt-4 font-editorial text-lg font-bold text-ink-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-ink-600 leading-relaxed">{description}</p>
    </div>
  );
}
