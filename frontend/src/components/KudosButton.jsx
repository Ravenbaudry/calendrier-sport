import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame } from 'lucide-react';
import { del, post } from '../api/client.js';
import { patchWorkoutInCaches } from '../lib/workouts.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function KudosButton({ workout }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { kudos } = workout;

  const mutation = useMutation({
    mutationFn: (give) => (give ? post : del)(`/workouts/${workout.id}/kudos`),
    // Mise à jour optimiste : le compteur réagit immédiatement
    onMutate: (give) => {
      const previous = workout.kudos;
      patchWorkoutInCaches(queryClient, workout.id, (w) => ({
        ...w,
        kudos: {
          count: w.kudos.count + (give ? 1 : -1),
          has_kudoed: give,
          users: give
            ? [...w.kudos.users, { id: user.id, username: user.username }]
            : w.kudos.users.filter((u) => u.id !== user.id),
        },
      }));
      return { previous };
    },
    onError: (_err, _give, context) => {
      patchWorkoutInCaches(queryClient, workout.id, (w) => ({ ...w, kudos: context.previous }));
    },
    onSuccess: (data) => {
      patchWorkoutInCaches(queryClient, workout.id, (w) => ({ ...w, kudos: data.kudos }));
    },
  });

  if (workout.is_owner) {
    return (
      <span className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-500" title="Kudos reçus">
        <Flame className="size-5" />
        <span className="tabular font-semibold">{kudos.count}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => mutation.mutate(!kudos.has_kudoed)}
      disabled={mutation.isPending}
      aria-pressed={kudos.has_kudoed}
      title={kudos.has_kudoed ? 'Retirer mon kudos' : 'Donner un kudos'}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all active:scale-90 ${
        kudos.has_kudoed
          ? 'bg-brand-500/15 text-brand-400'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
      }`}
    >
      <Flame className={`size-5 ${kudos.has_kudoed ? 'fill-brand-500' : ''}`} />
      <span className="tabular">{kudos.count}</span>
      <span className="hidden sm:inline">Kudos</span>
    </button>
  );
}

// « Léa, Tom et 3 autres »
export function KudosSummary({ kudos }) {
  if (!kudos.count) return null;
  const names = kudos.users.slice(0, 2).map((u) => u.username);
  const rest = kudos.count - names.length;
  return (
    <span className="truncate text-xs text-zinc-500">
      🔥 {names.join(', ')}
      {rest > 0 && ` et ${rest} autre${rest > 1 ? 's' : ''}`}
    </span>
  );
}
