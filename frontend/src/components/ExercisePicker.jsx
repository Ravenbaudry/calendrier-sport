import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Star } from 'lucide-react';
import { get, post } from '../api/client.js';
import { formatLine, formatShortDate } from '../lib/format.js';
import { ErrorMessage, Modal, PageLoader, Spinner } from './ui.jsx';

// Recherche insensible à la casse et aux accents (« developpe » trouve « Développé »)
export const normalize = (text) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function useExercises() {
  return useQuery({ queryKey: ['exercises'], queryFn: () => get('/exercises'), staleTime: 60_000 });
}

export default function ExercisePicker({ open, onClose, onSelect }) {
  const { data, isPending, error } = useExercises();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('Tous');
  const [creating, setCreating] = useState(false);

  const { favorites, sections } = useMemo(() => {
    if (!data) return { favorites: [], sections: [] };
    const q = normalize(search);
    const filtered = data.items.filter(
      (e) => (group === 'Tous' || e.muscle_group === group) && (!q || normalize(e.name).includes(q)),
    );
    const byGroup = new Map();
    for (const exercise of filtered) {
      if (!byGroup.has(exercise.muscle_group)) byGroup.set(exercise.muscle_group, []);
      byGroup.get(exercise.muscle_group).push(exercise);
    }
    return {
      favorites:
        !q && group === 'Tous'
          ? data.items.filter((e) => e.my_uses > 0).sort((a, b) => b.my_uses - a.my_uses).slice(0, 6)
          : [],
      sections: [...byGroup.entries()],
    };
  }, [data, search, group]);

  const close = () => {
    setSearch('');
    setCreating(false);
    onClose();
  };
  const choose = (exercise) => {
    onSelect(exercise);
    close();
  };

  return (
    <Modal open={open} onClose={close} title={creating ? 'Nouvel exercice' : 'Choisir un exercice'}>
      {creating ? (
        <CustomExerciseForm
          initialName={search}
          categories={data?.categories ?? []}
          muscleGroups={data?.muscle_groups ?? []}
          onCancel={() => setCreating(false)}
          onCreated={choose}
        />
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (squat, développé…)"
              className="input pl-10"
              autoFocus
            />
          </div>

          {data && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {['Tous', ...data.muscle_groups].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`chip ${group === g ? 'chip-active' : ''}`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {isPending && <PageLoader />}
          <ErrorMessage error={error} />

          {favorites.length > 0 && (
            <section>
              <h3 className="label flex items-center gap-1.5">
                <Star className="size-3.5 text-amber-300" /> Mes exercices fréquents
              </h3>
              <ExerciseList items={favorites} onChoose={choose} />
            </section>
          )}

          {sections.map(([muscleGroup, items]) => (
            <section key={muscleGroup}>
              <h3 className="label">{muscleGroup}</h3>
              <ExerciseList items={items} onChoose={choose} />
            </section>
          ))}

          {data && sections.length === 0 && (
            <p className="py-4 text-center text-sm text-zinc-500">Aucun exercice ne correspond.</p>
          )}

          {data && (
            <button type="button" className="btn-secondary w-full" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {search.trim() ? `Créer « ${search.trim()} »` : 'Créer un exercice personnalisé'}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

function ExerciseList({ items, onChoose }) {
  return (
    <ul className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800">
      {items.map((exercise) => (
        <li key={exercise.id}>
          <button
            type="button"
            onClick={() => onChoose(exercise)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-zinc-800/70 active:bg-zinc-800"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-zinc-100">
                {exercise.name}
                {exercise.is_custom && (
                  <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">
                    perso
                  </span>
                )}
              </div>
              <div className="truncate text-xs text-zinc-500">
                {exercise.category}
                {exercise.last &&
                  ` · Dernière fois (${formatShortDate(exercise.last.workout_date)}) : ${formatLine(exercise.last)}`}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-zinc-600" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CustomExerciseForm({ initialName = '', categories, muscleGroups, onCancel, onCreated }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: initialName.trim(),
    category: 'Barre',
    muscle_group: muscleGroups[0] ?? 'Pectoraux',
  });

  const mutation = useMutation({
    mutationFn: (body) => post('/exercises', body),
    onSuccess: ({ exercise }) => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
      onCreated(exercise);
    },
  });

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <div>
        <label className="label" htmlFor="exercise-name">Nom</label>
        <input
          id="exercise-name"
          className="input"
          value={form.name}
          onChange={update('name')}
          minLength={2}
          maxLength={80}
          required
          autoFocus
          placeholder="ex. Développé couché Smith"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="exercise-category">Matériel</label>
          <select id="exercise-category" className="input" value={form.category} onChange={update('category')}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="exercise-muscle">Groupe musculaire</label>
          <select id="exercise-muscle" className="input" value={form.muscle_group} onChange={update('muscle_group')}>
            {muscleGroups.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        L'exercice sera ajouté au catalogue commun et visible par tous les membres.
      </p>
      <ErrorMessage error={mutation.error} />
      <div className="flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
          {mutation.isPending ? <Spinner className="size-4 text-white" /> : <Plus className="size-4" />}
          Créer
        </button>
      </div>
    </form>
  );
}
