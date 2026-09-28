import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Trash2 } from 'lucide-react';
import { del } from '../api/client.js';
import { CustomExerciseForm, normalize, useExercises } from '../components/ExercisePicker.jsx';
import { ErrorMessage, Modal, PageHeader, PageLoader } from '../components/ui.jsx';
import { plural } from '../lib/format.js';

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useExercises();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('Tous');
  const [creating, setCreating] = useState(false);

  const remove = useMutation({
    mutationFn: (id) => del(`/exercises/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  });

  const sections = useMemo(() => {
    if (!data) return [];
    const q = normalize(search);
    const map = new Map();
    for (const e of data.items) {
      if (group !== 'Tous' && e.muscle_group !== group) continue;
      if (q && !normalize(e.name).includes(q)) continue;
      if (!map.has(e.muscle_group)) map.set(e.muscle_group, []);
      map.get(e.muscle_group).push(e);
    }
    return [...map.entries()];
  }, [data, search, group]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Exercices"
        subtitle={data ? `${plural(data.items.length, 'exercice')} dans le catalogue` : undefined}
        actions={
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> <span className="hidden sm:inline">Exercice perso</span>
          </button>
        }
      />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un exercice"
          className="input pl-10"
        />
      </div>
      {data && (
        <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4">
          {['Tous', ...data.muscle_groups].map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)} className={`chip ${group === g ? 'chip-active' : ''}`}>
              {g}
            </button>
          ))}
        </div>
      )}

      {isPending && <PageLoader />}
      <ErrorMessage error={error || remove.error} className="mb-4" />

      <div className="space-y-5">
        {sections.map(([muscleGroup, items]) => (
          <section key={muscleGroup}>
            <h2 className="label">{muscleGroup}</h2>
            <ul className="card divide-y divide-zinc-800 overflow-hidden">
              {items.map((exercise) => (
                <li key={exercise.id} className="flex items-center">
                  <Link
                    to={`/exercices/${exercise.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-zinc-100">{exercise.name}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {exercise.category}
                        {exercise.is_custom && ` · ajouté par ${exercise.created_by_username ?? 'un ancien membre'}`}
                      </div>
                    </div>
                    {exercise.my_uses > 0 && (
                      <span className="shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {plural(exercise.my_uses, 'séance')}
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-zinc-600" />
                  </Link>
                  {exercise.can_delete && (
                    <button
                      type="button"
                      className="btn-icon mr-2 hover:text-red-400"
                      aria-label={`Supprimer ${exercise.name}`}
                      onClick={() => {
                        if (window.confirm(`Supprimer « ${exercise.name} » du catalogue ?`)) remove.mutate(exercise.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {data && sections.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-500">Aucun exercice ne correspond à ta recherche.</p>
        )}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel exercice">
        {data && (
          <CustomExerciseForm
            initialName={search}
            categories={data.categories}
            muscleGroups={data.muscle_groups}
            onCancel={() => setCreating(false)}
            onCreated={() => setCreating(false)}
          />
        )}
      </Modal>
    </div>
  );
}
