import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Medal, TrendingUp } from 'lucide-react';
import { get } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { EmptyState, ErrorMessage, PageLoader, Segmented, Stat } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatKg, formatShortDate, formatVolume, formatDay } from '../lib/format.js';

const METRICS = [
  { value: 'max_weight', label: 'Charge max' },
  { value: 'best_e1rm', label: '1RM estimé' },
  { value: 'volume', label: 'Volume' },
];

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useAuth();
  const [searchParams] = useSearchParams();
  const username = searchParams.get('user') ?? me.username;
  const [metric, setMetric] = useState('max_weight');

  const { data, isPending, error } = useQuery({
    queryKey: ['exercise', Number(id), username.toLowerCase()],
    queryFn: () => get(`/exercises/${id}?user=${encodeURIComponent(username)}`),
  });

  if (isPending) return <PageLoader />;
  if (error) return <ErrorMessage error={error} />;

  const { exercise, history, personal_best: best, group_best: groupBest, user } = data;
  const isMe = user.id === me.id;
  const formatMetric = metric === 'volume' ? formatVolume : formatKg;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button type="button" onClick={() => navigate(-1)} className="btn-ghost -ml-2 px-2 py-1.5 text-zinc-400">
        <ArrowLeft className="size-4" /> Retour
      </button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-white">{exercise.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {exercise.muscle_group} · {exercise.category}
          {exercise.is_custom && ` · exercice perso de ${exercise.created_by_username ?? 'un ancien membre'}`}
        </p>
      </header>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <TrendingUp className="size-4 text-brand-400" />
            {isMe ? 'Ma progression' : `Progression de ${user.username}`}
          </h2>
          {history.length > 0 && <Segmented options={METRICS} value={metric} onChange={setMetric} size="sm" />}
        </div>

        {history.length === 0 ? (
          <EmptyState title="Pas encore de données">
            {isMe
              ? 'Ajoute cet exercice à une séance validée pour suivre ta progression.'
              : `${user.username} n'a pas encore fait cet exercice.`}
          </EmptyState>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <Stat label="Record" value={best ? formatKg(best.weight_kg) : '—'} hint={best && formatShortDate(best.workout_date)} accent />
              <Stat label="1RM estimé" value={best ? formatKg(best.best_e1rm) : '—'} hint="formule d'Epley" />
              <Stat label="Séances" value={history.length} hint={`depuis ${formatShortDate(history[0].workout_date)}`} />
            </div>
            <LineChart
              points={history.map((h) => ({ key: h.workout_id, x: h.workout_date, y: h[metric] }))}
              formatValue={formatMetric}
              formatLabel={formatShortDate}
            />
            <ul className="mt-5 divide-y divide-zinc-800 border-t border-zinc-800">
              {[...history].reverse().slice(0, 8).map((h) => (
                <li key={h.workout_id}>
                  <Link to={`/seance/${h.workout_id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-300">
                    <span className="text-zinc-300 first-letter:uppercase">{formatDay(h.workout_date, { weekday: false })}</span>
                    <span className="tabular text-right whitespace-nowrap">
                      <span className="block font-semibold text-zinc-100">max {formatKg(h.max_weight)}</span>
                      <span className="block text-xs text-zinc-500">
                        {h.sets} séries · {h.reps} reps
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <Medal className="size-4 text-amber-300" /> Meilleures charges du groupe
        </h2>
        {groupBest.length === 0 ? (
          <p className="py-4 text-sm text-zinc-500">Personne n'a encore soulevé de charge sur cet exercice.</p>
        ) : (
          <ol className="divide-y divide-zinc-800">
            {groupBest.map((entry, index) => (
              <li key={entry.user.id}>
                <Link
                  to={`/exercices/${exercise.id}?user=${entry.user.username}`}
                  className={`flex items-center gap-3 py-2.5 ${entry.user.id === user.id ? 'text-brand-300' : ''}`}
                >
                  <span className="tabular w-6 text-center font-bold text-zinc-500">{index + 1}</span>
                  <Avatar username={entry.user.username} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">{entry.user.username}</span>
                  <span className="tabular text-right text-sm">
                    <span className="font-bold text-zinc-100">{formatKg(entry.weight_kg)}</span>
                    <span className="text-zinc-500"> × {entry.reps}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
