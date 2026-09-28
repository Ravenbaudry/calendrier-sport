import { Router } from 'express';
import { query } from '../db.js';
import { badRequest, forbidden, notFound } from '../middleware/errors.js';
import { listValidatedWorkoutIds, loadWorkouts } from '../services/workouts.js';
import { commentSchema, idParam, paginationSchema } from '../validation.js';

export const socialRouter = Router();

// Fil d'actualité : dernières séances validées par tous les membres (instance privée = amis).
// GET /api/feed?limit=20&before=<id de la dernière séance reçue>
socialRouter.get('/feed', async (req, res) => {
  const { limit, before } = paginationSchema.parse(req.query);
  const { ids, nextCursor } = await listValidatedWorkoutIds({ before, limit, orderBy: 'validated_at' });
  res.json({ items: await loadWorkouts(ids, req.user.id), nextCursor });
});

// ---------------------------------------------------------------- Kudos

socialRouter.post('/workouts/:id/kudos', async (req, res) => {
  const workoutId = idParam.parse(req.params.id);
  const workout = await findValidatedWorkout(workoutId);
  if (workout.user_id === req.user.id) {
    throw badRequest('Pas de kudos pour ses propres séances 😉');
  }
  await query(
    `INSERT INTO kudos (workout_id, user_id) VALUES ($1, $2)
     ON CONFLICT (workout_id, user_id) DO NOTHING`,
    [workoutId, req.user.id],
  );
  res.status(201).json({ kudos: await kudosState(workoutId, req.user.id) });
});

socialRouter.delete('/workouts/:id/kudos', async (req, res) => {
  const workoutId = idParam.parse(req.params.id);
  await findValidatedWorkout(workoutId);
  await query('DELETE FROM kudos WHERE workout_id = $1 AND user_id = $2', [workoutId, req.user.id]);
  res.json({ kudos: await kudosState(workoutId, req.user.id) });
});

// ---------------------------------------------------------------- Commentaires

socialRouter.get('/workouts/:id/comments', async (req, res) => {
  const workoutId = idParam.parse(req.params.id);
  await findValidatedWorkout(workoutId);
  const { rows } = await query(
    `SELECT c.id, c.content, c.created_at, u.id AS user_id, u.username
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.workout_id = $1
     ORDER BY c.created_at, c.id`,
    [workoutId],
  );
  res.json({ items: rows.map((row) => formatComment(row, req.user.id)) });
});

socialRouter.post('/workouts/:id/comments', async (req, res) => {
  const workoutId = idParam.parse(req.params.id);
  const { content } = commentSchema.parse(req.body);
  await findValidatedWorkout(workoutId);
  const { rows } = await query(
    `INSERT INTO comments (workout_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING id, content, created_at`,
    [workoutId, req.user.id, content],
  );
  const comment = { ...rows[0], user_id: req.user.id, username: req.user.username };
  res.status(201).json({ comment: formatComment(comment, req.user.id) });
});

// Suppression : par l'auteur du commentaire ou par le propriétaire de la séance.
socialRouter.delete('/comments/:id', async (req, res) => {
  const commentId = idParam.parse(req.params.id);
  const { rows } = await query(
    `SELECT c.user_id AS author_id, w.user_id AS owner_id
     FROM comments c JOIN workouts w ON w.id = c.workout_id
     WHERE c.id = $1`,
    [commentId],
  );
  if (!rows[0]) throw notFound('Commentaire introuvable');
  if (![rows[0].author_id, rows[0].owner_id].includes(req.user.id)) {
    throw forbidden('Tu ne peux pas supprimer ce commentaire');
  }
  await query('DELETE FROM comments WHERE id = $1', [commentId]);
  res.status(204).end();
});

// ---------------------------------------------------------------- Helpers

// Les interactions ne sont possibles que sur des séances validées (les brouillons sont privés).
async function findValidatedWorkout(workoutId) {
  const { rows } = await query(
    `SELECT id, user_id FROM workouts WHERE id = $1 AND status = 'validated'`,
    [workoutId],
  );
  if (!rows[0]) throw notFound('Séance introuvable');
  return rows[0];
}

async function kudosState(workoutId, viewerId) {
  const { rows } = await query(
    `SELECT u.id, u.username
     FROM kudos k JOIN users u ON u.id = k.user_id
     WHERE k.workout_id = $1
     ORDER BY k.created_at`,
    [workoutId],
  );
  return { count: rows.length, has_kudoed: rows.some((u) => u.id === viewerId), users: rows };
}

function formatComment(row, viewerId) {
  return {
    id: row.id,
    content: row.content,
    created_at: row.created_at,
    user: { id: row.user_id, username: row.username },
    is_author: row.user_id === viewerId,
  };
}
