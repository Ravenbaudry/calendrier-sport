import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Crown, Weight } from 'lucide-react';
import { get } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import { ErrorMessage, PageHeader, PageLoader, Segmented } from '../components/ui.jsx';
import { formatShortDate, formatVolume, plural } from '../lib/format.js';

const TYPES = [
  { value: 'volume', label: 'Volume total', icon: Weight },
  { value: 'consistency', label: 'Régularité', icon: CalendarCheck },
];
const PERIODS = [
  { value: '7', label: '7 jours' },
  { value: '30', label: '30 jours' },
];

const MEDALS = ['text-amber-300', 'text-zinc-300', 'text-orange-400'];

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = searchParams.get('type') === 'consistency' ? 'consistency' : 'volume';
  const period = searchParams.get('periode') === '30' ? '30' : '7';

  const { data, isPending, error } = useQuery({
    queryKey: ['leaderboard', type, period],
    queryFn: () => get(`/leaderboard?type=${type}&period=${period}`),
    placeholderData: (previous) => previous,
  });

  const setParam = (key, value) =>
    setSearchParams((params) => {
      params.set(key, value);
      return params;
    }, { replace: true });

  const formatValue = (entry) =>
    type === 'volume' ? formatVolume(entry.value) : plural(entry.value, 'séance');
  const secondary = (entry) =>
    type === 'volume'
      ? plural(entry.workouts_count, 'séance')
      : `${plural(entry.active_days, 'jour actif', 'jours actifs')} · ${formatVolume(entry.volume)}`;

  const entries = data?.entries ?? [];
  const podium = entries.filter((e) => e.rank <= 3 && e.value > 0).slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Classements" subtitle="Qui a le plus poussé de fonte ?" />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented options={TYPES} value={type} onChange={(v) => setParam('type', v)} className="w-full sm:w-auto" />
        <Segmented options={PERIODS} value={period} onChange={(v) => setParam('periode', v)} size="sm" className="self-start" />
      </div>

      <p className="mb-5 text-xs text-zinc-500">
        {type === 'volume'
          ? 'Somme de séries × répétitions × poids (kg) des séances validées'
          : 'Nombre de séances validées'}
        {data?.start_date && ` du ${formatShortDate(data.start_date)} au ${formatShortDate(data.end_date)} inclus.`}
      </p>

      {isPending && <PageLoader />}
      <ErrorMessage error={error} />

      {podium.length > 0 && (
        <div className="mb-5 grid grid-cols-3 items-end gap-2 sm:gap-4">
          {[1, 0, 2].map((slot) => {
            const entry = podium[slot];
            if (!entry) return <div key={slot} />;
            const heights = ['h-28', 'h-20', 'h-16'];
            return (
              <Link key={entry.user.id} to={`/profil/${entry.user.username}`} className="flex flex-col items-center text-center">
                <div className="relative">
                  {entry.rank === 1 && <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 text-amber-300" />}
                  <Avatar username={entry.user.username} size={entry.rank === 1 ? 'xl' : 'lg'} className={entry.is_me ? 'ring-2 ring-brand-500' : ''} />
                </div>
                <span className="mt-2 w-full truncate text-sm font-semibold text-zinc-100">{entry.user.username}</span>
                <span className="tabular text-xs font-semibold text-brand-400">{formatValue(entry)}</span>
                <div
                  className={`mt-2 flex w-full items-start justify-center rounded-t-xl border border-b-0 border-zinc-800 bg-zinc-900 pt-2 ${heights[entry.rank - 1] ?? 'h-12'}`}
                >
                  <span className={`text-2xl font-black ${MEDALS[entry.rank - 1]}`}>{entry.rank}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {entries.length > 0 && (
        <ol className="card divide-y divide-zinc-800 overflow-hidden">
          {entries.map((entry) => (
            <li key={entry.user.id}>
              <Link
                to={`/profil/${entry.user.username}`}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/50 ${
                  entry.is_me ? 'bg-brand-500/10' : ''
                }`}
              >
                <span
                  className={`tabular w-7 text-center text-lg font-black ${
                    entry.value > 0 ? (MEDALS[entry.rank - 1] ?? 'text-zinc-500') : 'text-zinc-700'
                  }`}
                >
                  {entry.rank}
                </span>
                <Avatar username={entry.user.username} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-zinc-100">
                    {entry.user.username}
                    {entry.is_me && <span className="ml-2 text-xs font-medium text-brand-400">(toi)</span>}
                  </div>
                  <div className="truncate text-xs text-zinc-500">{secondary(entry)}</div>
                </div>
                <span className={`tabular text-right font-bold ${entry.value > 0 ? 'text-zinc-100' : 'text-zinc-600'}`}>
                  {formatValue(entry)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
