// Dates calendaires manipulées en chaînes 'YYYY-MM-DD' (heure locale du navigateur).

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toISODate(parseISODate(value)) === value;
}

export function addDays(iso, days) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso, months) {
  const date = parseISODate(iso);
  return toISODate(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

export function startOfMonth(iso) {
  return `${iso.slice(0, 7)}-01`;
}

// Grille du mois : semaines complètes du lundi au dimanche (35 ou 42 cases).
export function monthGrid(monthIso) {
  const first = parseISODate(startOfMonth(monthIso));
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = addDays(toISODate(first), -mondayOffset);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((mondayOffset + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => addDays(start, i));
}

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
