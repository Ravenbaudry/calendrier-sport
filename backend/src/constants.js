// Doivent rester synchronisées avec les contraintes CHECK de database/init/01-schema.sql
export const CATEGORIES = [
  'Barre',
  'Haltères',
  'Machine',
  'Poulie',
  'Poids du corps',
  'Kettlebell',
  'Cardio',
  'Autre',
];

export const MUSCLE_GROUPS = [
  'Pectoraux',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Avant-bras',
  'Quadriceps',
  'Ischio-jambiers',
  'Fessiers',
  'Mollets',
  'Abdominaux',
  'Corps entier',
  'Cardio',
];

export const WORKOUT_STATUSES = ['draft', 'validated'];

export const LEADERBOARD_TYPES = ['volume', 'consistency'];
export const LEADERBOARD_PERIODS = [7, 30];
