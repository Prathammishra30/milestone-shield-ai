import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, ShieldAlert } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {/* Main container shifted right on desktop */}
      <div className="flex flex-col lg:pl-64">
        {/* Top prototype banner */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-default bg-surface/90 px-4 py-2 backdrop-blur-xs sm:px-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded border border-border-default p-1.5 text-ink-700 hover:bg-canvas-subtle lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="font-semibold text-ink-900">PayPal AI Hackathon 2026</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline text-ink-500">Milestone Payment Shield Prototype</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded border border-[#F1D6B3] bg-[#FEF9F2] px-2 py-0.5 text-[11px] font-medium text-[#915416]">
              <ShieldAlert className="h-3 w-3" />
              <span>Sandbox Simulated</span>
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
