import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Plus, Trophy } from 'lucide-react';
import { get } from '../api/client.js';
import { ErrorMessage, PageHeader, Spinner, Stat } from '../components/ui.jsx';
import { WEEKDAYS_SHORT, addMonths, isValidISODate, monthGrid, startOfMonth, todayISO } from '../lib/dates.js';
import { formatLongDate, formatMonth, formatVolume, plural } from '../lib/format.js';
import { autoTitle, groupLines, summarizeGroup } from '../lib/workouts.js';

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayISO();
  const selected = isValidISODate(searchParams.get('jour')) ? searchParams.get('jour') : today;
  const month = isValidISODate(searchParams.get('mois')) ? searchParams.get('mois') : startOfMonth(selected);

  const days = useMemo(() => monthGrid(month), [month]);
  const from = days[0];
  const to = days.at(-1);

  const { data, isPending, error } = useQuery({
    queryKey: ['calendar', from, to],
    queryFn: () => get(`/workouts?from=${from}&to=${to}`),
    placeholderData: (previous) => previous,
  });

  const byDate = useMemo(() => {
    const map = new Map();
    for (const workout of data?.items ?? []) {
      if (!map.has(workout.workout_date)) map.set(workout.workout_date, []);
      map.get(workout.workout_date).push(workout);
    }
    return map;
  }, [data]);

  const monthStats = useMemo(() => {
    const monthKey = month.slice(0, 7);
    const validated = (data?.items ?? []).filter(
      (w) => w.status === 'validated' && w.workout_date.startsWith(monthKey),
    );
    return {
      workouts: validated.length,
      volume: validated.reduce((sum, w) => sum + w.totals.total_volume, 0),
      days: new Set(validated.map((w) => w.workout_date)).size,
      planned: (data?.items ?? []).filter((w) => w.status === 'draft' && w.workout_date.startsWith(monthKey))
        .length,
    };
  }, [data, month]);

  const go = (params) => setSearchParams(params, { replace: true });
  const selectDay = (iso) => go({ jour: iso, mois: startOfMonth(iso) });
  const changeMonth = (delta) => go({ jour: selected, mois: addMonths(month, delta) });

  const selectedWorkouts = byDate.get(selected) ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Calendrier" subtitle="Ton journal d'entraînement" />

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        {/* Grille du mois */}
        <section className="card p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button type="button" className="btn-icon" onClick={() => changeMonth(-1)} aria-label="Mois précédent">
              <ChevronLeft className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{formatMonth(month)}</h2>
              {isPending && <Spinner className="size-4" />}
            </div>
            <div className="flex items-center gap-1">
              {(month !== startOfMonth(today) || selected !== today) && (
                <button type="button" className="btn-ghost px-2.5 py-1.5 text-xs" onClick={() => selectDay(today)}>
                  Aujourd'hui
                </button>
              )}
              <button type="button" className="btn-icon" onClick={() => changeMonth(1)} aria-label="Mois suivant">
                <ChevronRight className="size-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((iso) => {
              const workouts = byDate.get(iso) ?? [];
              const validated = workouts.filter((w) => w.status === 'validated');
              const planned = workouts.filter((w) => w.status === 'draft');
              const inMonth = iso.slice(0, 7) === month.slice(0, 7);
              const isSelected = iso === selected;
              const isToday = iso === today;
              const hasPr = validated.some((w) => w.pr_count > 0);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => selectDay(iso)}
                  aria-pressed={isSelected}
                  aria-label={`${formatLongDate(iso)}${workouts.length ? ` : ${plural(workouts.length, 'séance')}` : ''}`}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition-colors sm:aspect-[4/3] ${
                    isSelected
                      ? 'bg-brand-500 text-white'
                      : validated.length
                        ? 'bg-brand-500/15 text-brand-200 hover:bg-brand-500/25'
                        : 'hover:bg-zinc-800'
                  } ${!inMonth && !isSelected ? 'opacity-35' : ''} ${
                    isToday && !isSelected ? 'ring-2 ring-brand-500 ring-inset' : ''
                  }`}
                >
                  <span className="tabular">{Number(iso.slice(8))}</span>
                  <span className="mt-1 flex h-1.5 gap-0.5">
                    {validated.slice(0, 3).map((w) => (
                      <span key={w.id} className={`size-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand-500'}`} />
                    ))}
                    {planned.slice(0, 2).map((w) => (
                      <span
                        key={w.id}
                        className={`size-1.5 rounded-full border ${isSelected ? 'border-white' : 'border-zinc-400'}`}
                      />
                    ))}
                  </span>
                  {hasPr && (
                    <Trophy className={`absolute top-1 right-1 size-3 ${isSelected ? 'text-white' : 'text-amber-300'}`} />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-500" /> Séance validée
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-zinc-400" /> Planifiée / brouillon
            </span>
            <span className="flex items-center gap-1.5">
              <Trophy className="size-3 text-amber-300" /> Record
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
            <Stat label="Séances" value={monthStats.workouts} hint={monthStats.planned ? `${monthStats.planned} planifiée(s)` : 'ce mois-ci'} />
            <Stat label="Jours actifs" value={monthStats.days} />
            <Stat label="Volume" value={formatVolume(monthStats.volume)} accent />
          </div>
        </section>

        {/* Détail du jour sélectionné */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-white first-letter:uppercase">{formatLongDate(selected)}</h2>
          </div>
          <ErrorMessage error={error} />

          {selectedWorkouts.map((workout) => (
            <DayWorkout key={workout.id} workout={workout} />
          ))}

          {selectedWorkouts.length === 0 && !isPending && (
            <p className="card px-4 py-6 text-center text-sm text-zinc-500">
              {selected > today ? 'Rien de prévu ce jour-là.' : 'Jour de repos 😴'}
            </p>
          )}

          <Link to={`/seance/nouvelle?date=${selected}`} className="btn-primary w-full py-3">
            <Plus className="size-4" />
            {selected > today ? 'Planifier une séance' : 'Ajouter une séance'}
          </Link>
        </section>
      </div>
    </div>
  );
}

function DayWorkout({ workout }) {
  const isDraft = workout.status === 'draft';
  const groups = groupLines(workout.exercises);
  return (
    <article className={`card p-4 ${isDraft ? 'border-dashed' : ''}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {isDraft ? (
              <span className="flex items-center gap-1 text-zinc-400">
                <CalendarClock className="size-3.5" /> Planifiée / brouillon
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="size-3.5" /> Validée
              </span>
            )}
          </div>
          <Link to={`/seance/${workout.id}`} className="mt-1 block truncate font-semibold text-zinc-100 hover:underline">
            {autoTitle(workout)}
          </Link>
        </div>
        <Link to={`/seance/${workout.id}/modifier`} className="btn-icon" aria-label="Modifier">
          <Pencil className="size-4" />
        </Link>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {groups.map((group) => (
          <li key={group.exercise_id} className="flex flex-wrap items-baseline justify-between gap-x-2">
            <span className="max-w-full truncate text-zinc-300">{group.name}</span>
            <span className="tabular ml-auto text-xs text-zinc-500">{summarizeGroup(group)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-4 border-t border-zinc-800 pt-2.5 text-xs text-zinc-400">
        <span>
          <span className="tabular font-semibold text-zinc-200">{workout.totals.total_sets}</span> séries
        </span>
        <span>
          Volume <span className="tabular font-semibold text-brand-400">{formatVolume(workout.totals.total_volume)}</span>
        </span>
        {!isDraft && (
          <span className="ml-auto">
            🔥 {workout.kudos.count} · 💬 {workout.comments_count}
          </span>
        )}
      </div>
    </article>
  );
}
