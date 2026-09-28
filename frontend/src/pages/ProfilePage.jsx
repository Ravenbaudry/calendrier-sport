import { Link, useParams } from 'react-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CalendarDays, Dumbbell, Flame, Settings, Trophy } from 'lucide-react';
import { get } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import BarChart, { HorizontalBars } from '../components/charts/BarChart.jsx';
import WorkoutCard from '../components/WorkoutCard.jsx';
import { EmptyState, ErrorMessage, PageLoader, Spinner, Stat } from '../components/ui.jsx';
import { formatDay, formatKg, formatNumber, formatShortDate, formatVolume, plural } from '../lib/format.js';
import { addDays } from '../lib/dates.js';

export default function ProfilePage() {
  const { username } = useParams();

  const { data, isPending, error } = useQuery({
    queryKey: ['profile', username.toLowerCase()],
    queryFn: () => get(`/users/${encodeURIComponent(username)}`),
  });

  const history = useInfiniteQuery({
    queryKey: ['user-workouts', username.toLowerCase()],
    queryFn: ({ pageParam }) =>
      get(`/users/${encodeURIComponent(username)}/workouts?limit=10${pageParam ? `&before=${pageParam}` : ''}`),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(data),
  });

  if (isPending) return <PageLoader />;
  if (error) return <ErrorMessage error={error} />;

  const { user, stats, weekly, records, muscle_split_30d: muscleSplit, is_me: isMe } = data;
  const workouts = history.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* En-tête du profil */}
      <section className="card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-brand-500/20 to-transparent" />
        <div className="relative flex items-center gap-4">
          <Avatar username={user.username} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-white">{user.username}</h1>
            <p className="text-sm text-zinc-400">
              Membre depuis {new Date(user.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
            {user.bio && <p className="mt-1.5 text-sm whitespace-pre-line text-zinc-300">{user.bio}</p>}
          </div>
          {isMe && (
            <Link to="/reglages" className="btn-icon self-start" aria-label="Modifier mon profil">
              <Settings className="size-5" />
            </Link>
          )}
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Séances" value={formatNumber(stats.workouts_count)} />
          <Stat label="Volume total" value={formatVolume(stats.total_volume)} accent />
          <Stat label="30 derniers jours" value={plural(stats.workouts_30d, 'séance')} hint={formatVolume(stats.volume_30d)} />
          <Stat label="Série" value={plural(stats.week_streak, 'sem.', 'sem.')} hint="consécutives" />
          <Stat label="Kudos reçus" value={formatNumber(stats.kudos_received)} />
          <Stat
            label="Dernière séance"
            value={stats.last_workout_date ? formatDay(stats.last_workout_date, { weekday: false }) : '—'}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <CalendarDays className="size-4 text-brand-400" /> Volume hebdomadaire
          </h2>
          <BarChart
            data={weekly.map((w) => ({
              key: w.week_start,
              label: `Semaine du ${formatShortDate(w.week_start)} au ${formatShortDate(addDays(w.week_start, 6))}`,
              shortLabel: formatShortDate(w.week_start),
              value: w.volume,
              detail: plural(w.workouts, 'séance'),
            }))}
            formatValue={formatVolume}
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
            <Dumbbell className="size-4 text-brand-400" /> Groupes musculaires (30 j)
          </h2>
          {muscleSplit.length > 0 ? (
            <HorizontalBars
              data={muscleSplit.slice(0, 8).map((m) => ({ label: m.muscle_group, value: m.sets }))}
              formatValue={(v) => plural(v, 'série')}
            />
          ) : (
            <p className="py-8 text-center text-sm text-zinc-500">Pas de séance sur les 30 derniers jours.</p>
          )}
        </section>
      </div>

      {records.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
            <Trophy className="size-4 text-amber-300" /> Records personnels
          </h2>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {records.slice(0, 12).map((record) => (
              <li key={record.exercise_id} className="border-b border-zinc-800/70">
                <Link
                  to={`/exercices/${record.exercise_id}?user=${user.username}`}
                  className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-300"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">{record.name}</div>
                    <div className="text-xs text-zinc-500">
                      {formatShortDate(record.workout_date)} · 1RM estimé {formatKg(record.estimated_1rm)}
                    </div>
                  </div>
                  <div className="tabular shrink-0 text-right">
                    <div className="font-bold text-zinc-100">{formatKg(record.weight_kg)}</div>
                    <div className="text-xs text-zinc-500">× {record.reps} reps</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-2xl space-y-4">
        <h2 className="flex items-center gap-2 font-semibold text-white">
          <Flame className="size-4 text-brand-400" /> Historique des séances
        </h2>
        {history.isPending && <PageLoader />}
        <ErrorMessage error={history.error} />
        {history.data && workouts.length === 0 && (
          <EmptyState icon={Dumbbell} title="Aucune séance validée">
            {isMe ? 'Ta première séance apparaîtra ici.' : `${user.username} n'a encore rien publié.`}
          </EmptyState>
        )}
        {workouts.map((workout) => (
          <WorkoutCard key={workout.id} workout={workout} showAuthor={false} />
        ))}
        {history.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => history.fetchNextPage()}
              disabled={history.isFetchingNextPage}
            >
              {history.isFetchingNextPage && <Spinner className="size-4" />}
              Séances plus anciennes
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
