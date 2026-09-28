import { z } from 'zod';
import { CATEGORIES, MUSCLE_GROUPS, WORKOUT_STATUSES } from './constants.js';

const trimmedOrNull = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const idParam = z.coerce.number().int().positive();

// Date calendaire stricte 'YYYY-MM-DD' (rejette 2024-02-30).
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : AAAA-MM-JJ')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Date inexistante');

export const username = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{3,30}$/, '3 à 30 caractères : lettres, chiffres, « _ », « . » ou « - »');

// bcrypt ignore tout ce qui dépasse 72 octets : on le refuse explicitement.
export const password = z
  .string()
  .min(8, 'Au moins 8 caractères')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Au plus 72 octets');

export const registerSchema = z.object({
  username,
  password,
  inviteCode: z.string().trim().optional(),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: password,
});

export const updateProfileSchema = z.object({
  bio: trimmedOrNull(280),
});

export const exerciseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  category: z.enum(CATEGORIES),
  muscle_group: z.enum(MUSCLE_GROUPS),
});

export const workoutLineSchema = z.object({
  exercise_id: z.number().int().positive(),
  sets: z.number().int().min(1).max(100),
  reps: z.number().int().min(1).max(1000),
  weight_kg: z
    .number()
    .min(0)
    .max(1000)
    .transform((value) => Math.round(value * 100) / 100),
  rest_seconds: z.number().int().min(0).max(3600).nullish().transform((v) => v ?? null),
});

export const workoutSchema = z
  .object({
    workout_date: isoDate,
    title: trimmedOrNull(100),
    notes: trimmedOrNull(5000),
    status: z.enum(WORKOUT_STATUSES).default('validated'),
    exercises: z.array(workoutLineSchema).max(60).default([]),
  })
  .refine((w) => w.status === 'draft' || w.exercises.length > 0, {
    message: 'Ajoute au moins un exercice pour valider la séance',
    path: ['exercises'],
  });

export const dateRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.from <= r.to, { message: '« from » doit précéder « to »' })
  .refine((r) => (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 <= 366, {
    message: 'Plage limitée à 366 jours',
  });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // Curseur = id de la dernière séance reçue
  before: z.coerce.number().int().positive().optional(),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Commentaire vide').max(1000),
});
