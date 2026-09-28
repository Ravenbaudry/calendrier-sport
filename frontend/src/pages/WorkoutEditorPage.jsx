import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Check,
  Copy,
  Dumbbell,
  History,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { get, post, put } from '../api/client.js';
import ExercisePicker from '../components/ExercisePicker.jsx';
import { ErrorMessage, PageHeader, PageLoader, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { isValidISODate, todayISO } from '../lib/dates.js';
import { formatDay, formatLine, formatRestShort, formatShortDate, formatVolume } from '../lib/format.js';

const DRAFT_KEY = 'calendrier-sport.new-workout';
const REST_PRESETS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

// Clés locales des lignes (crypto.randomUUID exige HTTPS : indisponible en http via VPN)
let lineCounter = 0;
const nextKey = () => `line-${Date.now()}-${lineCounter++}`;

function lineFromExercise(exercise, values = exercise.last) {
  return {
    key: nextKey(),
    exercise: {
      id: exercise.id ?? exercise.exercise_id,
      name: exercise.name,
      muscle_group: exercise.muscle_group,
      category: exercise.category,
      last: exercise.last ?? null,
    },
    sets: String(values?.sets ?? 3),
    reps: String(values?.reps ?? 10),
    weight: values?.weight_kg ? String(values.weight_kg).replace('.', ',') : '',
    rest: values?.rest_seconds != null ? String(values.rest_seconds) : '90',
  };
}

function formFromWorkout(workout, { keepDate = true } = {}) {
  return {
    workout_date: keepDate ? workout.workout_date : todayISO(),
    title: workout.title ?? '',
    notes: keepDate ? (workout.notes ?? '') : '',
    lines: workout.exercises.map((line) => lineFromExercise(line, line)),
  };
}

const emptyForm = (date) => ({ workout_date: date, title: '', notes: '', lines: [] });

// Conversion + validation d'une ligne saisie (virgule décimale acceptée)
function parseLine(line) {
  const sets = Number(line.sets);
  const reps = Number(line.reps);
  const weight = line.weight.trim() === '' ? 0 : Number(line.weight.replace(',', '.'));
  const errors = {
    sets: !Number.isInteger(sets) || sets < 1 || sets > 100,
    reps: !Number.isInteger(reps) || reps < 1 || reps > 1000,
    weight: !Number.isFinite(weight) || weight < 0 || weight > 1000,
  };
  return {
    errors,
    valid: !errors.sets && !errors.reps && !errors.weight,
    value: {
      exercise_id: line.exercise.id,
      sets,
      reps,
      weight_kg: weight,
      rest_seconds: line.rest === '' ? null : Number(line.rest),
    },
  };
}

function readLocalDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return draft && (draft.lines?.length || draft.title || draft.notes) ? draft : null;
  } catch {
    return null;
  }
}

function writeLocalDraft(form) {
  try {
    if (form) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* stockage indisponible (navigation privée) : on ignore */
  }
}

export default function WorkoutEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);

  const { data, isPending, error } = useQuery({
    queryKey: ['workout', Number(id)],
    queryFn: () => get(`/workouts/${id}`),
    enabled: isEdit,
  });

  if (isEdit && isPending) return <PageLoader />;
  if (isEdit && error) return <ErrorMessage error={error} />;
  // Nouvelle navigation vers l'éditeur (autre date, « Refaire »…) = formulaire réinitialisé ;
  // la saisie en cours reste récupérable via l'autosauvegarde locale.
  return <WorkoutForm key={id ?? location.key} existing={data?.workout} />;
}

function WorkoutForm({ existing }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const today = todayISO();
  const paramDate = searchParams.get('date');
  const template = location.state?.template;

  // État initial : séance existante > modèle (« refaire ») > saisie locale restaurée > vierge
  const [initial] = useState(() => {
    if (existing) return { form: formFromWorkout(existing), restored: false };
    const date = isValidISODate(paramDate) ? paramDate : today;
    if (template) {
      return { form: { ...formFromWorkout(template, { keepDate: false }), workout_date: date }, restored: false };
    }
    const draft = readLocalDraft();
    if (draft) {
      return {
        form: { ...draft, workout_date: isValidISODate(paramDate) ? paramDate : draft.workout_date },
        restored: true,
      };
    }
    return { form: emptyForm(date), restored: false };
  });
  const [form, setForm] = useState(initial.form);
  const [restored, setRestored] = useState(initial.restored);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const lastLineRef = useRef(null);

  // Autosauvegarde locale d'une nouvelle séance (téléphone verrouillé, onglet fermé…)
  useEffect(() => {
    if (!existing) writeLocalDraft(form);
  }, [form, existing]);

  const parsed = useMemo(() => form.lines.map(parseLine), [form.lines]);
  const totals = useMemo(
    () =>
      parsed.reduce(
        (acc, { valid, value }) =>
          valid
            ? { sets: acc.sets + value.sets, volume: acc.volume + value.sets * value.reps * value.weight_kg }
            : acc,
        { sets: 0, volume: 0 },
      ),
    [parsed],
  );

  const isFuture = form.workout_date > today;
  const isValidatedEdit = existing?.status === 'validated';

  const save = useMutation({
    mutationFn: (body) => (existing ? put(`/workouts/${existing.id}`, body) : post('/workouts', body)),
    onSuccess: ({ workout }) => {
      if (!existing) writeLocalDraft(null);
      queryClient.setQueryData(['workout', workout.id], { workout });
      for (const key of ['feed', 'calendar', 'profile', 'user-workouts', 'leaderboard', 'exercises', 'exercise']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      navigate(`/seance/${workout.id}`, { replace: true });
    },
  });

  if (existing && existing.user.id !== user.id) {
    return <ErrorMessage error={{ message: 'Tu ne peux modifier que tes propres séances.' }} />;
  }

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const updateLine = (key, field, value) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, [field]: value } : l)) }));
  const removeLine = (key) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== key) }));
  const duplicateLine = (key) =>
    setForm((f) => {
      const index = f.lines.findIndex((l) => l.key === key);
      const copy = { ...f.lines[index], key: nextKey() };
      return { ...f, lines: [...f.lines.slice(0, index + 1), copy, ...f.lines.slice(index + 1)] };
    });
  const moveLine = (key, delta) =>
    setForm((f) => {
      const lines = [...f.lines];
      const index = lines.findIndex((l) => l.key === key);
      const target = index + delta;
      if (target < 0 || target >= lines.length) return f;
      [lines[index], lines[target]] = [lines[target], lines[index]];
      return { ...f, lines };
    });
  const addExercise = (exercise) => {
    setForm((f) => ({ ...f, lines: [...f.lines, lineFromExercise(exercise)] }));
    setTimeout(() => lastLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };
  const resetForm = () => {
    writeLocalDraft(null);
    setRestored(false);
    setForm(emptyForm(today));
  };

  const submit = (status) => {
    setSubmitted(true);
    if (parsed.some((p) => !p.valid)) return;
    save.mutate({
      workout_date: form.workout_date,
      title: form.title.trim() || null,
      notes: form.notes.trim() || null,
      status,
      exercises: parsed.map((p) => p.value),
    });
  };

  const hasInvalid = submitted && parsed.some((p) => !p.valid);
  const title = existing ? 'Modifier la séance' : template ? 'Refaire une séance' : 'Nouvelle séance';

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={title}
        subtitle={formatDay(form.workout_date)}
        actions={
          !existing &&
          (form.lines.length > 0 || form.title || form.notes) && (
            <button type="button" className="btn-ghost px-3" onClick={resetForm}>
              <RotateCcw className="size-4" /> Vider
            </button>
          )
        }
      />

      {restored && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-sky-900/60 bg-sky-950/40 px-3.5 py-2.5 text-sm text-sky-200">
          <History className="size-4 shrink-0" />
          <span className="flex-1">Saisie en cours restaurée.</span>
          <button type="button" className="font-semibold underline" onClick={resetForm}>
            Recommencer
          </button>
        </div>
      )}

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        {/* Date, titre, notes */}
        <section className="card space-y-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="workout-date">Date</label>
              <input
                id="workout-date"
                type="date"
                className="input"
                value={form.workout_date}
                onChange={(e) => e.target.value && setField('workout_date')(e)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="workout-title">Titre (optionnel)</label>
              <input
                id="workout-title"
                className="input"
                value={form.title}
                onChange={setField('title')}
                maxLength={100}
                placeholder="Push, Jambes, Full body…"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="workout-notes">Notes de séance</label>
            <textarea
              id="workout-notes"
              className="input min-h-20"
              value={form.notes}
              onChange={setField('notes')}
              maxLength={5000}
              rows={3}
              placeholder="Ressenti, forme du jour, sensations…"
            />
          </div>
        </section>

        {/* Exercices */}
        {form.lines.length === 0 ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="card flex w-full flex-col items-center gap-2 border-dashed px-6 py-10 text-zinc-400 transition-colors hover:border-brand-500 hover:text-brand-300"
          >
            <Dumbbell className="size-8" />
            <span className="font-semibold">Ajouter un premier exercice</span>
            <span className="text-xs text-zinc-500">Choisis dans le catalogue pour éviter les fautes de frappe</span>
          </button>
        ) : (
          <ol className="space-y-3">
            {form.lines.map((line, index) => (
              <li key={line.key} ref={index === form.lines.length - 1 ? lastLineRef : undefined}>
                <LineEditor
                  line={line}
                  index={index}
                  count={form.lines.length}
                  errors={submitted ? parsed[index].errors : {}}
                  volume={parsed[index].valid ? parsed[index].value : null}
                  onChange={(field, value) => updateLine(line.key, field, value)}
                  onRemove={() => removeLine(line.key)}
                  onDuplicate={() => duplicateLine(line.key)}
                  onMove={(delta) => moveLine(line.key, delta)}
                />
              </li>
            ))}
          </ol>
        )}

        {form.lines.length > 0 && (
          <button type="button" className="btn-secondary w-full py-3" onClick={() => setPickerOpen(true)}>
            <Plus className="size-4" /> Ajouter un exercice
          </button>
        )}

        {/* Barre d'actions collante */}
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
          <div className="card space-y-3 border-zinc-700 bg-zinc-900/95 p-3 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-zinc-400">
                <span className="tabular font-semibold text-zinc-100">{totals.sets}</span> séries
              </span>
              <span className="text-zinc-400">
                Volume <span className="tabular font-semibold text-brand-400">{formatVolume(totals.volume)}</span>
              </span>
            </div>
            {hasInvalid && (
              <ErrorMessage error={{ message: 'Vérifie les valeurs surlignées en rouge.' }} />
            )}
            <ErrorMessage error={save.error} />
            <div className="flex gap-2">
              {isValidatedEdit ? (
                <button
                  type="button"
                  className="btn-primary flex-1 py-3"
                  disabled={save.isPending || form.lines.length === 0}
                  onClick={() => submit('validated')}
                >
                  {save.isPending ? <Spinner className="size-4 text-white" /> : <Check className="size-4" />}
                  Enregistrer
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className={`${isFuture ? 'btn-primary' : 'btn-secondary'} flex-1 py-3`}
                    disabled={save.isPending}
                    onClick={() => submit('draft')}
                    title="Séance privée, non publiée dans le fil"
                  >
                    <CalendarClock className="size-4" />
                    {isFuture ? 'Planifier' : 'Brouillon'}
                  </button>
                  {!isFuture && (
                    <button
                      type="button"
                      className="btn-primary flex-[2] py-3"
                      disabled={save.isPending || form.lines.length === 0}
                      onClick={() => submit('validated')}
                    >
                      {save.isPending ? <Spinner className="size-4 text-white" /> : <Check className="size-4" />}
                      Valider la séance
                    </button>
                  )}
                </>
              )}
            </div>
            {isFuture && !isValidatedEdit && (
              <p className="px-1 text-xs text-zinc-500">
                Séance future : elle sera planifiée dans ton calendrier et pourra être validée le jour J.
              </p>
            )}
          </div>
        </div>

        {existing && (
          <div className="text-center">
            <Link to={`/seance/${existing.id}`} className="text-sm text-zinc-500 hover:text-zinc-300">
              Annuler les modifications
            </Link>
          </div>
        )}
      </form>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addExercise} />
    </div>
  );
}

function LineEditor({ line, index, count, errors, volume, onChange, onRemove, onDuplicate, onMove }) {
  const restValue = line.rest === '' ? '' : Number(line.rest);
  const restOptions = REST_PRESETS.includes(restValue) || restValue === '' ? REST_PRESETS : [...REST_PRESETS, restValue].sort((a, b) => a - b);
  const invalid = 'border-red-500 focus:border-red-500 focus:ring-red-500/30';

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-sm font-bold text-brand-400">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 leading-snug font-semibold text-zinc-100">{line.exercise.name}</h3>
          <p className="truncate text-xs text-zinc-500">
            {line.exercise.muscle_group} · {line.exercise.category}
          </p>
        </div>
        <div className="-mt-1 -mr-2 flex">
          <button type="button" className="btn-icon" onClick={onDuplicate} aria-label="Dupliquer la ligne" title="Dupliquer (ex. montée en charge)">
            <Copy className="size-4" />
          </button>
          <button type="button" className="btn-icon hover:text-red-400" onClick={onRemove} aria-label="Supprimer la ligne">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        <NumberField label="Séries" value={line.sets} onChange={(v) => onChange('sets', v)} className={errors.sets ? invalid : ''} />
        <NumberField label="Reps" value={line.reps} onChange={(v) => onChange('reps', v)} className={errors.reps ? invalid : ''} />
        <NumberField
          label="Poids kg"
          value={line.weight}
          onChange={(v) => onChange('weight', v)}
          decimal
          placeholder="PDC"
          className={errors.weight ? invalid : ''}
        />
        <div>
          <span className="label truncate">Repos</span>
          <select
            className="input px-1.5 text-center"
            value={line.rest}
            onChange={(e) => onChange('rest', e.target.value)}
            aria-label="Temps de repos"
          >
            <option value="">—</option>
            {restOptions.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatRestShort(seconds)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-xs text-zinc-500">
          {line.exercise.last ? (
            <p>
              Dernière fois ({formatShortDate(line.exercise.last.workout_date)}) : {formatLine(line.exercise.last)}
            </p>
          ) : (
            <p>Poids vide = poids du corps</p>
          )}
          {volume && volume.weight_kg > 0 && (
            <p className="tabular">Volume {formatVolume(volume.sets * volume.reps * volume.weight_kg)}</p>
          )}
        </div>
        <div className="-mr-2 flex shrink-0">
          <button type="button" className="btn-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Monter">
            <ArrowUp className="size-4" />
          </button>
          <button type="button" className="btn-icon" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Descendre">
            <ArrowDown className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, decimal = false, placeholder, className = '' }) {
  return (
    <label className="block min-w-0">
      <span className="label truncate">{label}</span>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
        className={`input tabular px-2 text-center text-base font-semibold ${className}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(decimal ? /[^0-9.,]/g : /\D/g, ''))}
        onFocus={(e) => e.target.select()}
      />
    </label>
  );
}
