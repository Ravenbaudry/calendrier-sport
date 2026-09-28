import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, Check, Pencil, Repeat, Timer, Trash2, Trophy } from 'lucide-react';
import { del, get, put } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import CommentsSection from '../components/CommentsSection.jsx';
import KudosButton from '../components/KudosButton.jsx';
import { ErrorMessage, PageLoader, Spinner, Stat } from '../components/ui.jsx';
import { todayISO } from '../lib/dates.js';
import { formatKg, formatLongDate, formatNumber, formatRest, formatVolume, timeAgo } from '../lib/format.js';
import { autoTitle } from '../lib/workouts.js';

export default function WorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workoutId = Number(id);

  const { data, isPending, error } = useQuery({
    queryKey: ['workout', workoutId],
    queryFn: () => get(`/workouts/${workoutId}`),
  });

  const invalidateLists = () => {
    for (const key of ['feed', 'calendar', 'profile', 'user-workouts', 'leaderboard', 'exercises', 'exercise']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const remove = useMutation({
    mutationFn: () => del(`/workouts/${workoutId}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['workout', workoutId] });
      invalidateLists();
      navigate('/calendrier', { replace: true });
    },
  });

  // Valider une séance planifiée sans repasser par le formulaire
  const validate = useMutation({
    mutationFn: (workout) =>
      put(`/workouts/${workout.id}`, {
        workout_date: workout.workout_date,
        title: workout.title,
        notes: workout.notes,
        status: 'validated',
        exercises: workout.exercises.map(({ exercise_id, sets, reps, weight_kg, rest_seconds }) => ({
          exercise_id,
          sets,
          reps,
          weight_kg,
          rest_seconds,
        })),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(['workout', workoutId], result);
      invalidateLists();
    },
  });

  if (isPending) return <PageLoader />;
  if (error) return <ErrorMessage error={error} />;

  const { workout } = data;
  const isDraft = workout.status === 'draft';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button type="button" onClick={() => navigate(-1)} className="btn-ghost -ml-2 px-2 py-1.5 text-zinc-400">
        <ArrowLeft className="size-4" /> Retour
      </button>

      {isDraft && (
        <div className="card flex flex-wrap items-center gap-3 border-dashed border-zinc-600 px-4 py-3">
          <CalendarClock className="size-5 text-zinc-400" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-zinc-200">Séance planifiée / brouillon</p>
            <p className="text-zinc-500">Visible par toi uniquement. Valide-la pour la publier dans le fil.</p>
          </div>
          {workout.workout_date <= todayISO() && workout.exercises.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              disabled={validate.isPending}
              onClick={() => validate.mutate(workout)}
            >
              {validate.isPending ? <Spinner className="size-4 text-white" /> : <Check className="size-4" />}
              Valider
            </button>
          )}
          <ErrorMessage error={validate.error} className="w-full" />
        </div>
      )}

      <article className="card overflow-hidden">
        <header className="flex items-center gap-3 p-4">
          <Link to={`/profil/${workout.user.username}`}>
            <Avatar username={workout.user.username} size="lg" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link to={`/profil/${workout.user.username}`} className="font-semibold text-zinc-100 hover:underline">
              {workout.user.username}
            </Link>
            <p className="text-sm text-zinc-400 first-letter:uppercase">{formatLongDate(workout.workout_date)}</p>
            {workout.validated_at && (
              <p className="text-xs text-zinc-500">Publiée {timeAgo(workout.validated_at)}</p>
            )}
          </div>
        </header>

        <div className="px-4 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">{autoTitle(workout)}</h1>
          {workout.notes && <p className="mt-2 text-sm whitespace-pre-line text-zinc-300">{workout.notes}</p>}

          <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-zinc-950/60 p-4 sm:grid-cols-4">
            <Stat label="Volume" value={formatVolume(workout.totals.total_volume)} accent />
            <Stat label="Séries" value={workout.totals.total_sets} />
            <Stat label="Répétitions" value={formatNumber(workout.totals.total_reps)} />
            <Stat label="Records" value={workout.pr_count} />
          </div>
        </div>

        {/* Détail des lignes */}
        <ul className="divide-y divide-zinc-800/70 border-t border-zinc-800">
          {workout.exercises.map((line) => (
            <li key={line.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/exercices/${line.exercise_id}?user=${workout.user.username}`}
                  className="font-medium text-zinc-100 hover:text-brand-300"
                >
                  {line.name}
                </Link>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
                  <span>{line.muscle_group}</span>
                  {line.rest_seconds != null && (
                    <span className="flex items-center gap-0.5">
                      <Timer className="size-3" /> repos {formatRest(line.rest_seconds)}
                    </span>
                  )}
                </div>
                {line.is_pr && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    <Trophy className="size-3" /> Record perso
                  </span>
                )}
              </div>
              <div className="tabular shrink-0 text-right whitespace-nowrap">
                <div className="font-semibold text-zinc-100">
                  {line.sets} × {line.reps}
                  <span className="text-zinc-400"> @ </span>
                  {line.weight_kg > 0 ? formatKg(line.weight_kg) : 'PDC'}
                </div>
                {line.volume > 0 && <div className="text-xs text-zinc-500">{formatVolume(line.volume)}</div>}
              </div>
            </li>
          ))}
          {workout.exercises.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-zinc-500">Aucun exercice pour l'instant.</li>
          )}
        </ul>

        <footer className="flex flex-wrap items-center gap-2 border-t border-zinc-800 px-2 py-2">
          {!isDraft && <KudosButton workout={workout} />}
          {!isDraft && workout.kudos.count > 0 && (
            <span className="min-w-0 truncate text-xs text-zinc-500">
              {workout.kudos.users.map((u) => u.username).join(', ')}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Link
              to="/seance/nouvelle"
              state={{ template: workout }}
              className="btn-ghost px-3 py-2"
              title="Créer une nouvelle séance à partir de celle-ci"
            >
              <Repeat className="size-4" /> Refaire
            </Link>
            {workout.is_owner && (
              <>
                <Link to={`/seance/${workout.id}/modifier`} className="btn-icon" aria-label="Modifier">
                  <Pencil className="size-4" />
                </Link>
                <button
                  type="button"
                  className="btn-icon hover:text-red-400"
                  aria-label="Supprimer"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm('Supprimer définitivement cette séance ?')) remove.mutate();
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </footer>
      </article>
      <ErrorMessage error={remove.error} />

      {!isDraft && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-white">Commentaires ({workout.comments_count})</h2>
          <CommentsSection workout={workout} />
        </section>
      )}
    </div>
  );
}
