import { parseISODate, todayISO, addDays } from './dates.js';

const numberFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const integerFr = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const relativeFr = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

export const formatNumber = (value) => numberFr.format(value ?? 0);

export function formatKg(value) {
  return `${numberFr.format(value ?? 0)} kg`;
}

// Volume : en tonnes au-delà de 10 000 kg pour rester lisible.
export function formatVolume(value) {
  const v = value ?? 0;
  if (v >= 10_000) return `${numberFr.format(v / 1000)} t`;
  return `${integerFr.format(v)} kg`;
}

export function formatLine({ sets, reps, weight_kg: weight }) {
  const load = weight > 0 ? ` × ${formatKg(weight)}` : ' × PDC';
  return `${sets} × ${reps}${load}`;
}

export function formatRest(seconds) {
  if (seconds == null) return null;
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${min} min ${pad2(sec)}` : `${min} min`;
}

const pad2 = (n) => String(n).padStart(2, '0');

// Notation courte des salles de sport : 45 s, 1', 1'30, 2'
export function formatRestShort(seconds) {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec ? `${min}'${pad2(sec)}` : `${min}'`;
}

// « Aujourd'hui », « Hier », « lundi 12 mai », « 12 mai 2024 »
export function formatDay(iso, { weekday = true } = {}) {
  if (!iso) return '';
  const today = todayISO();
  if (iso === today) return "Aujourd'hui";
  if (iso === addDays(today, -1)) return 'Hier';
  if (iso === addDays(today, 1)) return 'Demain';
  const date = parseISODate(iso);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('fr-FR', {
    weekday: weekday ? 'long' : undefined,
    day: 'numeric',
    month: 'long',
    year: sameYear ? undefined : 'numeric',
  });
}

export function formatLongDate(iso) {
  return parseISODate(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMonth(iso) {
  const label = parseISODate(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDate(iso) {
  return parseISODate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// « il y a 5 min », « hier », etc.
export function timeAgo(isoDateTime) {
  const diffSeconds = (new Date(isoDateTime).getTime() - Date.now()) / 1000;
  const units = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeFr.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "à l'instant";
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`;
}
