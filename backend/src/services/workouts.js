import { query } from '../db.js';
import { round } from '../utils/math.js';

// Charge des séances complètes (lignes, totaux, kudos, records) en conservant l'ordre des ids.
// Les requêtes sont groupées (3 requêtes quel que soit le nombre de séances : pas de N+1).
export async function loadWorkouts(ids, viewerId) {
  if (ids.length === 0) return [];

  const [base, lines, kudos] = await Promise.all([
    query(
      `SELECT w.id, w.workout_date, w.title, w.notes, w.status, w.validated_at,
              w.created_at, w.updated_at,
              u.id AS user_id, u.username,
              t.exercise_count, t.total_sets, t.total_reps, t.total_volume,
              (SELECT COUNT(*) FROM comments c WHERE c.workout_id = w.id)::int AS comments_count
       FROM workouts w
       JOIN users u ON u.id = w.user_id
       CROSS JOIN LATERAL (
         SELECT COUNT(DISTINCT we.exercise_id)::int                    AS exercise_count,
                COALESCE(SUM(we.sets), 0)::int                          AS total_sets,
                COALESCE(SUM(we.sets * we.reps), 0)::int                AS total_reps,
                COALESCE(SUM(we.sets * we.reps * we.weight_kg), 0)      AS total_volume
         FROM workout_exercises we
         WHERE we.workout_id = w.id
       ) t
       WHERE w.id = ANY($1::int[])`,
      [ids],
    ),
    // is_pr : charge strictement supérieure au meilleur poids des séances validées précédentes
    query(
      `SELECT we.id, we.workout_id, we.exercise_id, we.position, we.sets, we.reps,
              we.weight_kg, we.rest_seconds,
              e.name, e.category, e.muscle_group,
              (w.status = 'validated' AND we.weight_kg > 0 AND we.weight_kg > (
                 SELECT MAX(we2.weight_kg)
                 FROM workout_exercises we2
                 JOIN workouts w2 ON w2.id = we2.workout_id
                 WHERE w2.user_id = w.user_id
                   AND w2.status = 'validated'
                   AND we2.exercise_id = we.exercise_id
                   AND (w2.workout_date, w2.id) < (w.workout_date, w.id)
              )) IS TRUE AS beats_previous
       FROM workout_exercises we
       JOIN workouts w ON w.id = we.workout_id
       JOIN exercise_catalog e ON e.id = we.exercise_id
       WHERE we.workout_id = ANY($1::int[])
       ORDER BY we.workout_id, we.position, we.id`,
      [ids],
    ),
    query(
      `SELECT k.workout_id, u.id, u.username
       FROM kudos k
       JOIN users u ON u.id = k.user_id
       WHERE k.workout_id = ANY($1::int[])
       ORDER BY k.created_at`,
      [ids],
    ),
  ]);

  const linesByWorkout = groupBy(lines.rows, 'workout_id');
  const kudosByWorkout = groupBy(kudos.rows, 'workout_id');
  const byId = new Map(base.rows.map((row) => [row.id, row]));

  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const row = byId.get(id);
      const exercises = markRecords(linesByWorkout.get(id) ?? []);
      const kudosUsers = (kudosByWorkout.get(id) ?? []).map(({ id: userId, username }) => ({
        id: userId,
        username,
      }));
      return {
        id: row.id,
        workout_date: row.workout_date,
        title: row.title,
        notes: row.notes,
        status: row.status,
        validated_at: row.validated_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        user: { id: row.user_id, username: row.username },
        is_owner: row.user_id === viewerId,
        totals: {
          exercise_count: row.exercise_count,
          total_sets: row.total_sets,
          total_reps: row.total_reps,
          total_volume: round(row.total_volume),
        },
        exercises,
        pr_count: exercises.filter((line) => line.is_pr).length,
        kudos: {
          count: kudosUsers.length,
          has_kudoed: kudosUsers.some((u) => u.id === viewerId),
          users: kudosUsers,
        },
        comments_count: row.comments_count,
      };
    });
}

export async function loadWorkout(id, viewerId) {
  const [workout] = await loadWorkouts([id], viewerId);
  return workout ?? null;
}

// Un brouillon n'est visible que par son auteur.
export function canView(workout, viewerId) {
  return workout && (workout.status === 'validated' || workout.user.id === viewerId);
}

// Liste paginée (keyset) des séances validées, pour le fil ou un profil.
//   orderBy 'validated_at' : fil d'actualité (dernières validées en premier)
//   orderBy 'workout_date' : historique d'un profil
export async function listValidatedWorkoutIds({ userId = null, before = null, limit, orderBy }) {
  const column = orderBy === 'workout_date' ? 'workout_date' : 'validated_at';
  const { rows } = await query(
    `SELECT w.id
     FROM workouts w
     WHERE w.status = 'validated'
       AND ($1::int IS NULL OR w.user_id = $1)
       AND ($2::int IS NULL OR (w.${column}, w.id) < (
             SELECT c.${column}, c.id FROM workouts c WHERE c.id = $2))
     ORDER BY w.${column} DESC, w.id DESC
     LIMIT $3`,
    [userId, before, limit],
  );
  const ids = rows.map((row) => row.id);
  return { ids, nextCursor: ids.length === limit ? ids.at(-1) : null };
}

// Volume d'une ligne + badge « record » (une seule ligne par exercice : la plus lourde).
function markRecords(lines) {
  const bestLineByExercise = new Map();
  for (const line of lines) {
    if (!line.beats_previous) continue;
    const best = bestLineByExercise.get(line.exercise_id);
    if (!best || line.weight_kg > best.weight_kg) bestLineByExercise.set(line.exercise_id, line);
  }
  const recordIds = new Set([...bestLineByExercise.values()].map((line) => line.id));

  return lines.map((line) => ({
    id: line.id,
    exercise_id: line.exercise_id,
    name: line.name,
    category: line.category,
    muscle_group: line.muscle_group,
    position: line.position,
    sets: line.sets,
    reps: line.reps,
    weight_kg: line.weight_kg,
    rest_seconds: line.rest_seconds,
    volume: round(line.sets * line.reps * line.weight_kg),
    is_pr: recordIds.has(line.id),
  }));
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row[key]);
    if (list) list.push(row);
    else map.set(row[key], [row]);
  }
  return map;
}
