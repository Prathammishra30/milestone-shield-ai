import { NavLink } from 'react-router-dom';
import {
  FileText,
  FolderKanban,
  Target,
  FileCheck2,
  Receipt,
  Settings,
  Shield,
  X,
  UserCheck,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  { to: '/', label: 'Contracts', icon: FileText, subtitle: 'Active Workspace' },
  { to: '/projects', label: 'All Contracts', icon: FolderKanban, subtitle: 'Portfolio Directory' },
  { to: '/milestones', label: 'Milestones', icon: Target, subtitle: 'Criteria & Delivery' },
  { to: '/submissions', label: 'Reviews', icon: FileCheck2, subtitle: 'Deliverable Verification' },
  { to: '/payments', label: 'Payments', icon: Receipt, subtitle: 'Payment Ledger' },
  { to: '/settings', label: 'Settings', icon: Settings, subtitle: 'Policy & Sandbox' },
];

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-[#1C3529] bg-[#12241C] text-[#EAF2EE] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between border-b border-[#1C3529] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-[#2D5541] bg-[#172E23] text-[#EAF2EE] shadow-inner">
              <Shield className="h-5 w-5 text-[#88C4A7]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-editorial text-base font-bold tracking-tight text-[#FAF8F5]">
                  MilestoneShield
                </span>
                <span className="rounded bg-[#234836] px-1.5 py-0.2 text-[9px] font-bold tracking-wider text-[#A3D9C0] uppercase">
                  AI
                </span>
              </div>
              <p className="text-[10px] tracking-wide text-[#7C978B]">
                Proof before payout.
              </p>
            </div>
          </div>

          {/* Close button for mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="rounded p-1 text-[#7C978B] hover:bg-[#1C3529] hover:text-[#FAF8F5] lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main navigation">
          <p className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-[#688577] uppercase">
            Workspace
          </p>
          <ul className="space-y-1">
            {navItems.map(({ to, label, icon: Icon, subtitle }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  onClick={onCloseMobile}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-medium transition-all ${
                      isActive
                        ? 'border-l-2 border-[#D2821E] bg-[#1A3428] text-[#FAF8F5] shadow-xs'
                        : 'text-[#9BB3A7] hover:bg-[#162D22] hover:text-[#FAF8F5]'
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] font-normal text-[#6E8A7D]">
                      {subtitle}
                    </span>
                  </div>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Counterparty persona card */}
        <div className="border-t border-[#1C3529] p-3.5">
          <div className="rounded-md border border-[#234434] bg-[#162D22] p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#203F30] text-[#88C4A7]">
                <UserCheck className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#FAF8F5]">Acme Retail Corp</p>
                <p className="text-[10px] text-[#7C978B]">Client Authority · Sandbox</p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 px-1">
            <p className="text-[10px] leading-tight text-[#6E8A7D]">
              ⚠️ Prototype Demo — Sample data only. Not a regulated escrow service. No real money moved.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
