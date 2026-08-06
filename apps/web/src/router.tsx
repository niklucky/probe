import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { ProfilePage } from '@/pages/profile';
import { DashboardPage } from '@/pages/dashboard';
import { ProjectPage } from '@/pages/project';
import { ProductPage } from '@/pages/product';
import { TestSuitePage } from '@/pages/test-suite';
import { TestRunsPage } from '@/pages/test-runs';
import { TestRunCreatePage } from '@/pages/test-run-create';
import { TestRunExecutePage } from '@/pages/test-run-execute';
import { TestRunResultsPage } from '@/pages/test-run-results';
import { TeamsPage } from '@/pages/teams';
import { EnvironmentsPage } from '@/pages/environments';
import { ProtectedRoute } from '@/components/protected-route';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'projects/:projectId',
        element: <ProjectPage />,
      },
      {
        path: 'projects/:projectId/teams',
        element: <TeamsPage />,
      },
      {
        path: 'projects/:projectId/products/:productId/environments',
        element: <EnvironmentsPage />,
      },
      {
        path: 'projects/:projectId/products/:productId',
        element: <ProductPage />,
      },
      {
        path: 'projects/:projectId/products/:productId/suites/:suiteId',
        element: <TestSuitePage />,
      },
      {
        path: 'projects/:projectId/runs',
        element: <TestRunsPage />,
      },
      {
        path: 'projects/:projectId/runs/create',
        element: <TestRunCreatePage />,
      },
      {
        path: 'projects/:projectId/runs/:runId/execute',
        element: <TestRunExecutePage />,
      },
      {
        path: 'projects/:projectId/runs/:runId/results',
        element: <TestRunResultsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
