export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

// Formule d'Epley : estimation du 1RM à partir d'une série de N répétitions.
export function estimateOneRepMax(weight, reps) {
  if (reps <= 1) return round(weight, 1);
  return round(weight * (1 + reps / 30), 1);
}
