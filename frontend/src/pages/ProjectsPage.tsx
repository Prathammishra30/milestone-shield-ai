import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, User, Calendar } from 'lucide-react';
import StatusBadge, { projectVariant } from '../components/StatusBadge';
import { sampleProjects } from '../data/sampleData';

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border-default pb-5">
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold tracking-tight text-ink-900">
          All Contracts & Engagements
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Portfolio directory of active, completed, and pending milestone contracts.
          <span className="ml-1 text-ink-400">(Sample demonstration data)</span>
        </p>
      </div>

      {/* Contract Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {sampleProjects.map((project) => {
          const progress =
            project.totalBudget > 0
              ? Math.round((project.paidAmount / project.totalBudget) * 100)
              : 0;

          return (
            <div
              key={project.id}
              className="group flex flex-col justify-between rounded-xl border border-border-default bg-surface p-5 shadow-xs transition-all hover:border-border-strong hover:shadow-sm"
            >
              <div>
                {/* Title & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-[11px] text-ink-400">CTR-{project.id}</span>
                    <h3 className="font-editorial text-lg font-bold text-ink-900 group-hover:text-[#1E4334] transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <StatusBadge
                    label={project.status}
                    variant={projectVariant(project.status)}
                  />
                </div>

                {/* Counterparties */}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-600">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-ink-400" />
                    <span>{project.client}</span>
                  </div>
                  <span>·</span>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-ink-400" />
                    <span>{project.freelancer}</span>
                  </div>
                </div>

                {project.scopeSummary && (
                  <p className="mt-3 text-xs text-ink-500 leading-relaxed line-clamp-2">
                    {project.scopeSummary}
                  </p>
                )}

                {/* Financial Progress Bar */}
                <div className="mt-5 rounded-lg border border-border-subtle bg-canvas-subtle p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-600">Funding Utilization</span>
                    <span className="font-editorial font-bold text-ink-900">
                      ${project.paidAmount.toLocaleString()} / ${project.totalBudget.toLocaleString()}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border-default">
                    <div
                      className="h-full rounded-full bg-[#1E4334] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink-500">
                    <span>{project.completedMilestones} of {project.milestoneCount} Milestones Settled</span>
                    <span>{progress}% Released</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 flex items-center justify-between border-t border-border-subtle pt-3 text-xs">
                <div className="flex items-center gap-1 text-[11px] text-ink-400">
                  <Calendar className="h-3 w-3" />
                  <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                </div>

                <Link
                  to="/"
                  className="inline-flex items-center gap-1 font-semibold text-[#1E4334] hover:underline"
                >
                  <span>Open Workspace</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
