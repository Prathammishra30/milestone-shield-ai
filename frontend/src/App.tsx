import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Code-split pages for optimized bundle size and fast initial load
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const MilestonesPage = lazy(() => import('./pages/MilestonesPage'));
const SubmissionsPage = lazy(() => import('./pages/SubmissionsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface px-4 py-2.5 shadow-2xs">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1E4334] border-t-transparent" />
        <span className="text-xs font-medium text-ink-600">Loading workspace...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Suspense fallback={<PageLoader />}>
                <OverviewPage />
              </Suspense>
            }
          />
          <Route
            path="projects"
            element={
              <Suspense fallback={<PageLoader />}>
                <ProjectsPage />
              </Suspense>
            }
          />
          <Route
            path="milestones"
            element={
              <Suspense fallback={<PageLoader />}>
                <MilestonesPage />
              </Suspense>
            }
          />
          <Route
            path="submissions"
            element={
              <Suspense fallback={<PageLoader />}>
                <SubmissionsPage />
              </Suspense>
            }
          />
          <Route
            path="payments"
            element={
              <Suspense fallback={<PageLoader />}>
                <PaymentsPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
