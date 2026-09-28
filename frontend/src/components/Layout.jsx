import { Link, NavLink, Outlet } from 'react-router';
import { CalendarDays, Dumbbell, Home, Plus, Settings, Trophy, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';

export function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-bold tracking-tight text-white ${className}`}>
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="text-lg">
        Calendrier<span className="text-brand-500">Sport</span>
      </span>
    </Link>
  );
}

const desktopLinks = [
  { to: '/', label: 'Fil', icon: Home, end: true },
  { to: '/calendrier', label: 'Calendrier', icon: CalendarDays },
  { to: '/classement', label: 'Classement', icon: Trophy },
  { to: '/exercices', label: 'Exercices', icon: Dumbbell },
  { to: '/membres', label: 'Membres', icon: Users },
];

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="min-h-dvh">
      {/* En-tête */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {desktopLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                  }`
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <Link to="/seance/nouvelle" className="btn-primary hidden py-2 md:inline-flex">
              <Plus className="size-4" /> Séance
            </Link>
            <Link to="/exercices" className="btn-icon md:hidden" aria-label="Exercices">
              <Dumbbell className="size-5" />
            </Link>
            <Link to="/membres" className="btn-icon md:hidden" aria-label="Membres">
              <Users className="size-5" />
            </Link>
            <Link to="/reglages" className="btn-icon" aria-label="Réglages">
              <Settings className="size-5" />
            </Link>
            <Link
              to={`/profil/${user.username}`}
              className="ml-1 hidden rounded-full ring-brand-500 transition hover:ring-2 md:block"
              aria-label="Mon profil"
            >
              <Avatar username={user.username} size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-12">
        <Outlet />
      </main>

      {/* Barre d'onglets mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          <TabLink to="/" end icon={Home} label="Fil" />
          <TabLink to="/calendrier" icon={CalendarDays} label="Calendrier" />
          <div className="flex justify-center">
            <Link
              to="/seance/nouvelle"
              aria-label="Nouvelle séance"
              className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/30 ring-4 ring-zinc-950 transition active:scale-95"
            >
              <Plus className="size-7" strokeWidth={2.5} />
            </Link>
          </div>
          <TabLink to="/classement" icon={Trophy} label="Classement" />
          <TabLink to={`/profil/${user.username}`} icon={User} label="Profil" />
        </div>
      </nav>
    </div>
  );
}

function TabLink({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 text-[11px] font-medium transition-colors ${
          isActive ? 'text-brand-400' : 'text-zinc-500'
        }`
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  );
}
