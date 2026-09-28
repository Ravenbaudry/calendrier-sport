import { Link } from 'react-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Dumbbell, Plus, RefreshCw } from 'lucide-react';
import { get } from '../api/client.js';
import WorkoutCard from '../components/WorkoutCard.jsx';
import { EmptyState, ErrorMessage, PageHeader, PageLoader, Spinner } from '../components/ui.jsx';

export default function FeedPage() {
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['feed'],
      queryFn: ({ pageParam, signal }) =>
        get(`/feed?limit=15${pageParam ? `&before=${pageParam}` : ''}`, { signal }),
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: 60_000,
    });

  const workouts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Fil d'actualité"
        subtitle="Les dernières séances validées par la bande"
        actions={
          <button
            type="button"
            className="btn-icon"
            onClick={() => refetch()}
            aria-label="Actualiser"
            disabled={isRefetching}
          >
            <RefreshCw className={`size-5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      {isPending && <PageLoader />}
      <ErrorMessage error={error} />

      {!isPending && !error && workouts.length === 0 && (
        <EmptyState
          icon={Dumbbell}
          title="Aucune séance pour l'instant"
          action={
            <Link to="/seance/nouvelle" className="btn-primary">
              <Plus className="size-4" /> Enregistrer ma première séance
            </Link>
          }
        >
          Dès qu'un membre valide une séance, elle apparaît ici. Montre l'exemple !
        </EmptyState>
      )}

      <div className="space-y-4">
        {workouts.map((workout) => (
          <WorkoutCard key={workout.id} workout={workout} />
        ))}
      </div>

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button type="button" className="btn-secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Spinner className="size-4" />}
            Voir les séances précédentes
          </button>
        </div>
      )}
      {!hasNextPage && workouts.length > 0 && (
        <p className="mt-8 text-center text-xs text-zinc-600">Tu es à jour 💪</p>
      )}
    </div>
  );
}
