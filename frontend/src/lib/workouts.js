// Aides partagées autour des séances (titres, regroupement, cache React Query).
import { formatKg, formatLine } from './format.js';

export function autoTitle(workout) {
  if (workout.title) return workout.title;
  const groups = [...new Set(workout.exercises.map((e) => e.muscle_group))];
  if (groups.length === 0) return 'Séance';
  return groups.slice(0, 3).join(' · ') + (groups.length > 3 ? '…' : '');
}

// Regroupe les lignes consécutives ou non d'un même exercice (ordre de première apparition).
export function groupLines(exercises) {
  const groups = new Map();
  for (const line of exercises) {
    const group = groups.get(line.exercise_id);
    if (group) {
      group.lines.push(line);
      group.volume += line.volume;
      group.is_pr ||= line.is_pr;
    } else {
      groups.set(line.exercise_id, {
        exercise_id: line.exercise_id,
        name: line.name,
        muscle_group: line.muscle_group,
        lines: [line],
        volume: line.volume,
        is_pr: line.is_pr,
      });
    }
  }
  return [...groups.values()];
}

// Résumé compact d'un exercice : « 4 × 8 × 80 kg » ou « 7 séries · max 110 kg »
export function summarizeGroup(group) {
  if (group.lines.length <= 2) return group.lines.map(formatLine).join(' · ');
  const sets = group.lines.reduce((sum, l) => sum + l.sets, 0);
  const max = Math.max(...group.lines.map((l) => l.weight_kg));
  return `${sets} séries · max ${max > 0 ? formatKg(max) : 'PDC'}`;
}

// Applique `updater` à une séance partout où elle est en cache
// (détail, fil, historique de profil, calendrier).
export function patchWorkoutInCaches(queryClient, workoutId, updater) {
  const patchList = (list) => list.map((w) => (w.id === workoutId ? updater(w) : w));

  queryClient.setQueryData(['workout', workoutId], (data) =>
    data ? { ...data, workout: updater(data.workout) } : data,
  );
  for (const key of [['feed'], ['user-workouts']]) {
    queryClient.setQueriesData({ queryKey: key }, (data) =>
      data?.pages
        ? { ...data, pages: data.pages.map((page) => ({ ...page, items: patchList(page.items) })) }
        : data,
    );
  }
  queryClient.setQueriesData({ queryKey: ['calendar'] }, (data) =>
    data?.items ? { ...data, items: patchList(data.items) } : data,
  );
}
