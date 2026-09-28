import { Link, Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import Layout from './components/Layout.jsx';
import { PageLoader } from './components/ui.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AuthPage from './pages/AuthPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ExerciseDetailPage from './pages/ExerciseDetailPage.jsx';
import ExercisesPage from './pages/ExercisesPage.jsx';
import FeedPage from './pages/FeedPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import MembersPage from './pages/MembersPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import WorkoutDetailPage from './pages/WorkoutDetailPage.jsx';
import WorkoutEditorPage from './pages/WorkoutEditorPage.jsx';

// Routes réservées aux membres connectés
function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status !== 'authenticated') {
    return <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

// Pages de connexion : inutiles si déjà connecté
function PublicOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-6xl font-black text-zinc-800">404</p>
      <p className="mt-2 text-zinc-400">Cette page a sauté la séance.</p>
      <Link to="/" className="btn-primary mt-6">
        Retour au fil
      </Link>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicOnly />,
    children: [
      { path: '/connexion', element: <AuthPage mode="login" /> },
      { path: '/inscription', element: <AuthPage mode="register" /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <Layout />,
        children: [
          { index: true, element: <FeedPage /> },
          { path: '/calendrier', element: <CalendarPage /> },
          { path: '/seance/nouvelle', element: <WorkoutEditorPage /> },
          { path: '/seance/:id', element: <WorkoutDetailPage /> },
          { path: '/seance/:id/modifier', element: <WorkoutEditorPage /> },
          { path: '/classement', element: <LeaderboardPage /> },
          { path: '/profil/:username', element: <ProfilePage /> },
          { path: '/exercices', element: <ExercisesPage /> },
          { path: '/exercices/:id', element: <ExerciseDetailPage /> },
          { path: '/membres', element: <MembersPage /> },
          { path: '/reglages', element: <SettingsPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
