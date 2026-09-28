// Tests d'intégration de l'API contre une vraie base PostgreSQL.
// ⚠ La base est entièrement réinitialisée : son nom DOIT contenir « test ».
//   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/calendrier_test npm test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !new URL(databaseUrl).pathname.includes('test')) {
  throw new Error('TEST_DATABASE_URL requis, avec un nom de base contenant « test »');
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  BCRYPT_ROUNDS: '4',
  INVITE_CODE: 'entre-potes',
  TZ: 'Europe/Paris',
});

const INIT_DIR = path.resolve(import.meta.dirname, '../../database/init');

let server;
let baseUrl;
let pool;

async function resetDatabase() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  for (const file of (await readdir(INIT_DIR)).filter((f) => f.endsWith('.sql')).sort()) {
    await client.query(await readFile(path.join(INIT_DIR, file), 'utf8'));
  }
  await client.end();
}

async function api(method, url, { token, body } = {}) {
  const res = await fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(username, password = 'motdepasse123') {
  const res = await api('POST', '/api/auth/register', {
    body: { username, password, inviteCode: 'entre-potes' },
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.token;
}

function isoDaysAgo(days) {
  // Date locale Europe/Paris, cohérente avec CURRENT_DATE côté PostgreSQL
  const date = new Date(Date.now() - days * 86_400_000);
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

let exerciseIds;

before(async () => {
  await resetDatabase();
  const { createApp } = await import('../src/app.js');
  ({ pool } = await import('../src/db.js'));
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const { rows } = await pool.query(
    `SELECT name, id FROM exercise_catalog WHERE name IN ('Développé couché', 'Squat', 'Tractions')`,
  );
  exerciseIds = Object.fromEntries(rows.map((r) => [r.name, r.id]));
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

describe('authentification', () => {
  test('inscription : code invitation, format du pseudo, unicité insensible à la casse', async () => {
    let res = await api('POST', '/api/auth/register', {
      body: { username: 'alice', password: 'motdepasse123', inviteCode: 'mauvais' },
    });
    assert.equal(res.status, 403);

    res = await api('POST', '/api/auth/register', {
      body: { username: 'a!', password: 'motdepasse123', inviteCode: 'entre-potes' },
    });
    assert.equal(res.status, 400);

    res = await api('POST', '/api/auth/register', {
      body: { username: 'alice', password: 'court', inviteCode: 'entre-potes' },
    });
    assert.equal(res.status, 400);

    await register('alice');
    res = await api('POST', '/api/auth/register', {
      body: { username: 'ALICE', password: 'motdepasse123', inviteCode: 'entre-potes' },
    });
    assert.equal(res.status, 409);
  });

  test('connexion, /me, et rejet des jetons invalides', async () => {
    let res = await api('POST', '/api/auth/login', {
      body: { username: 'Alice', password: 'mauvais-mdp' },
    });
    assert.equal(res.status, 401);

    res = await api('POST', '/api/auth/login', {
      body: { username: 'Alice', password: 'motdepasse123' },
    });
    assert.equal(res.status, 200);
    const { token } = res.body;

    res = await api('GET', '/api/auth/me', { token });
    assert.equal(res.body.user.username, 'alice');
    assert.equal(res.body.user.password_hash, undefined);

    assert.equal((await api('GET', '/api/feed')).status, 401);
    assert.equal((await api('GET', '/api/feed', { token: `${token}x` })).status, 401);
  });

  test('changer de mot de passe révoque les anciens jetons', async () => {
    const oldToken = await register('carol');
    const res = await api('PUT', '/api/auth/password', {
      token: oldToken,
      body: { currentPassword: 'motdepasse123', newPassword: 'nouveaumdp456' },
    });
    assert.equal(res.status, 200);
    assert.equal((await api('GET', '/api/auth/me', { token: oldToken })).status, 401);
    assert.equal((await api('GET', '/api/auth/me', { token: res.body.token })).status, 200);
  });
});

describe('séances, social et classements', () => {
  let alice;
  let bob;
  let workoutId;

  before(async () => {
    alice = (await api('POST', '/api/auth/login', {
      body: { username: 'alice', password: 'motdepasse123' },
    })).body.token;
    bob = await register('bob');
  });

  test('catalogue d’exercices + exercice personnalisé', async () => {
    let res = await api('GET', '/api/exercises', { token: alice });
    assert.ok(res.body.items.length >= 50);
    assert.ok(res.body.muscle_groups.includes('Pectoraux'));

    res = await api('POST', '/api/exercises', {
      token: alice,
      body: { name: 'Développé couché', category: 'Barre', muscle_group: 'Pectoraux' },
    });
    assert.equal(res.status, 409);

    res = await api('POST', '/api/exercises', {
      token: alice,
      body: { name: 'Pompes lestées', category: 'Poids du corps', muscle_group: 'Pectoraux' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.exercise.is_custom, true);

    const customId = res.body.exercise.id;
    assert.equal((await api('DELETE', `/api/exercises/${customId}`, { token: bob })).status, 403);
    assert.equal((await api('DELETE', `/api/exercises/${customId}`, { token: alice })).status, 204);
  });

  test('création d’une séance validée avec calcul du volume', async () => {
    const res = await api('POST', '/api/workouts', {
      token: alice,
      body: {
        workout_date: isoDaysAgo(2),
        title: 'Push',
        notes: 'Bonne forme',
        exercises: [
          { exercise_id: exerciseIds['Développé couché'], sets: 4, reps: 8, weight_kg: 80, rest_seconds: 120 },
          { exercise_id: exerciseIds.Tractions, sets: 3, reps: 10, weight_kg: 0 },
        ],
      },
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const { workout } = res.body;
    workoutId = workout.id;
    assert.equal(workout.status, 'validated');
    assert.equal(workout.totals.total_volume, 4 * 8 * 80);
    assert.equal(workout.totals.total_sets, 7);
    assert.equal(workout.exercises[0].rest_seconds, 120);
    assert.equal(workout.exercises[1].rest_seconds, null);
    assert.equal(workout.pr_count, 0);
  });

  test('validation des entrées d’une séance', async () => {
    const valid = { exercise_id: exerciseIds.Squat, sets: 3, reps: 5, weight_kg: 100 };
    const cases = [
      { workout_date: '2025-02-30', exercises: [valid] }, // date inexistante
      { workout_date: isoDaysAgo(0), exercises: [] }, // validée sans exercice
      { workout_date: isoDaysAgo(0), exercises: [{ ...valid, sets: 0 }] },
      { workout_date: isoDaysAgo(0), exercises: [{ ...valid, weight_kg: -5 }] },
      { workout_date: isoDaysAgo(0), exercises: [{ ...valid, exercise_id: 999999 }] },
      { workout_date: isoDaysAgo(-10), exercises: [valid] }, // future et validée
    ];
    for (const body of cases) {
      const res = await api('POST', '/api/workouts', { token: alice, body });
      assert.equal(res.status, 400, `${JSON.stringify(body)} → ${JSON.stringify(res.body)}`);
    }
  });

  test('séance planifiée (brouillon) : privée, puis validée', async () => {
    let res = await api('POST', '/api/workouts', {
      token: bob,
      body: {
        workout_date: isoDaysAgo(-3),
        status: 'draft',
        title: 'Jambes (prévu)',
        exercises: [{ exercise_id: exerciseIds.Squat, sets: 5, reps: 5, weight_kg: 100 }],
      },
    });
    assert.equal(res.status, 201);
    const draftId = res.body.workout.id;
    assert.equal(res.body.workout.validated_at, null);

    assert.equal((await api('GET', `/api/workouts/${draftId}`, { token: alice })).status, 404);
    assert.equal((await api('POST', `/api/workouts/${draftId}/kudos`, { token: alice })).status, 404);
    res = await api('GET', '/api/feed', { token: alice });
    assert.ok(!res.body.items.some((w) => w.id === draftId));

    res = await api('PUT', `/api/workouts/${draftId}`, {
      token: alice,
      body: { workout_date: isoDaysAgo(0), exercises: [] , status: 'draft' },
    });
    assert.equal(res.status, 403);

    res = await api('PUT', `/api/workouts/${draftId}`, {
      token: bob,
      body: {
        workout_date: isoDaysAgo(0),
        title: 'Jambes',
        exercises: [
          { exercise_id: exerciseIds.Squat, sets: 5, reps: 5, weight_kg: 100 },
          { exercise_id: exerciseIds.Squat, sets: 1, reps: 3, weight_kg: 110 },
        ],
      },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.workout.status, 'validated');
    assert.equal(res.body.workout.totals.total_volume, 5 * 5 * 100 + 3 * 110);
    assert.deepEqual(res.body.workout.exercises.map((e) => e.weight_kg), [100, 110]);

    res = await api('GET', '/api/feed', { token: alice });
    assert.equal(res.body.items[0].id, draftId);
  });

  test('record personnel détecté à la séance suivante', async () => {
    const res = await api('POST', '/api/workouts', {
      token: alice,
      body: {
        workout_date: isoDaysAgo(1),
        exercises: [
          { exercise_id: exerciseIds['Développé couché'], sets: 3, reps: 5, weight_kg: 85 },
          { exercise_id: exerciseIds['Développé couché'], sets: 1, reps: 2, weight_kg: 90 },
        ],
      },
    });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body.workout.exercises.map((e) => e.is_pr), [false, true]);
    assert.equal(res.body.workout.pr_count, 1);
  });

  test('kudos : un seul par personne, pas sur ses propres séances', async () => {
    assert.equal((await api('POST', `/api/workouts/${workoutId}/kudos`, { token: alice })).status, 400);

    let res = await api('POST', `/api/workouts/${workoutId}/kudos`, { token: bob });
    assert.equal(res.status, 201);
    res = await api('POST', `/api/workouts/${workoutId}/kudos`, { token: bob });
    assert.deepEqual(
      { count: res.body.kudos.count, has_kudoed: res.body.kudos.has_kudoed },
      { count: 1, has_kudoed: true },
    );

    res = await api('GET', `/api/workouts/${workoutId}`, { token: alice });
    assert.equal(res.body.workout.kudos.count, 1);
    assert.equal(res.body.workout.kudos.has_kudoed, false);
    assert.equal(res.body.workout.kudos.users[0].username, 'bob');

    res = await api('DELETE', `/api/workouts/${workoutId}/kudos`, { token: bob });
    assert.equal(res.body.kudos.count, 0);
    await api('POST', `/api/workouts/${workoutId}/kudos`, { token: bob });
  });

  test('commentaires : ajout, liste, droits de suppression', async () => {
    let res = await api('POST', `/api/workouts/${workoutId}/comments`, {
      token: bob,
      body: { content: '  Belle perf au DC !  ' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.comment.content, 'Belle perf au DC !');
    const bobComment = res.body.comment.id;

    res = await api('POST', `/api/workouts/${workoutId}/comments`, {
      token: alice,
      body: { content: '   ' },
    });
    assert.equal(res.status, 400);

    res = await api('POST', `/api/workouts/${workoutId}/comments`, {
      token: alice,
      body: { content: 'Merci 💪' },
    });
    const aliceComment = res.body.comment.id;

    res = await api('GET', `/api/workouts/${workoutId}/comments`, { token: alice });
    assert.deepEqual(res.body.items.map((c) => c.user.username), ['bob', 'alice']);

    // Bob ne peut pas supprimer le commentaire d'Alice sur la séance d'Alice…
    assert.equal((await api('DELETE', `/api/comments/${aliceComment}`, { token: bob })).status, 403);
    // …mais Alice (propriétaire de la séance) peut supprimer celui de Bob.
    assert.equal((await api('DELETE', `/api/comments/${bobComment}`, { token: alice })).status, 204);

    res = await api('GET', `/api/workouts/${workoutId}`, { token: bob });
    assert.equal(res.body.workout.comments_count, 1);
  });

  test('fil d’actualité paginé par curseur', async () => {
    const page1 = await api('GET', '/api/feed?limit=2', { token: bob });
    assert.equal(page1.body.items.length, 2);
    assert.ok(page1.body.nextCursor);
    const page2 = await api('GET', `/api/feed?limit=2&before=${page1.body.nextCursor}`, { token: bob });
    const ids = [...page1.body.items, ...page2.body.items].map((w) => w.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 3);
    assert.equal(page2.body.nextCursor, null);
  });

  test('classement par volume et par régularité', async () => {
    let res = await api('GET', '/api/leaderboard?type=volume&period=7', { token: bob });
    assert.equal(res.status, 200);
    const byName = Object.fromEntries(res.body.entries.map((e) => [e.user.username, e]));
    // alice : 4×8×80 + 3×5×85 + 1×2×90 = 2560 + 1275 + 180
    assert.equal(byName.alice.value, 4015);
    assert.equal(byName.bob.value, 2830);
    assert.equal(byName.alice.rank, 1);
    assert.equal(byName.carol.value, 0);
    assert.equal(byName.bob.is_me, true);

    res = await api('GET', '/api/leaderboard?type=consistency&period=30', { token: bob });
    const consistency = Object.fromEntries(res.body.entries.map((e) => [e.user.username, e]));
    assert.equal(consistency.alice.value, 2);
    assert.equal(consistency.bob.value, 1);

    assert.equal((await api('GET', '/api/leaderboard?period=14', { token: bob })).status, 400);
  });

  test('profil et statistiques', async () => {
    const res = await api('GET', '/api/users/ALICE', { token: bob });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, 'alice');
    assert.equal(res.body.stats.workouts_count, 2);
    assert.equal(res.body.stats.total_volume, 4015);
    assert.equal(res.body.stats.kudos_received, 1);
    assert.ok(res.body.stats.week_streak >= 1);
    assert.equal(res.body.weekly.length, 12);
    assert.equal(res.body.records[0].weight_kg, 90);
    assert.equal(res.body.records[0].estimated_1rm, 96);

    assert.equal((await api('GET', '/api/users/inconnu', { token: bob })).status, 404);
  });

  test('progression sur un exercice', async () => {
    const res = await api('GET', `/api/exercises/${exerciseIds['Développé couché']}?user=alice`, {
      token: bob,
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.history.map((h) => h.max_weight), [80, 90]);
    assert.equal(res.body.personal_best.weight_kg, 90);
    assert.equal(res.body.group_best[0].user.username, 'alice');

    // Dernière performance (pré-remplissage de la saisie) : ligne la plus lourde de la dernière séance
    const catalog = await api('GET', '/api/exercises', { token: alice });
    const bench = catalog.body.items.find((e) => e.id === exerciseIds['Développé couché']);
    assert.equal(bench.my_uses, 2);
    assert.deepEqual(
      { sets: bench.last.sets, reps: bench.last.reps, weight_kg: bench.last.weight_kg },
      { sets: 1, reps: 2, weight_kg: 90 },
    );
    assert.equal(catalog.body.items.find((e) => e.id === exerciseIds.Squat).last, null);
  });

  test('calendrier et suppression', async () => {
    let res = await api('GET', `/api/workouts?from=${isoDaysAgo(30)}&to=${isoDaysAgo(-30)}`, {
      token: alice,
    });
    assert.equal(res.body.items.length, 2);

    assert.equal((await api('DELETE', `/api/workouts/${workoutId}`, { token: bob })).status, 403);
    assert.equal((await api('DELETE', `/api/workouts/${workoutId}`, { token: alice })).status, 204);
    assert.equal((await api('GET', `/api/workouts/${workoutId}`, { token: alice })).status, 404);
  });
});
