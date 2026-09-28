import { useState } from 'react';
import { Link } from 'react-router';
import { MessageCircle, Trophy } from 'lucide-react';
import { formatDay, formatVolume, plural, timeAgo } from '../lib/format.js';
import { autoTitle, groupLines, summarizeGroup } from '../lib/workouts.js';
import Avatar from './Avatar.jsx';
import CommentsSection from './CommentsSection.jsx';
import KudosButton, { KudosSummary } from './KudosButton.jsx';
import { Stat } from './ui.jsx';

const MAX_GROUPS = 4;

// Carte d'une séance dans le fil d'actualité (style Strava).
export default function WorkoutCard({ workout, showAuthor = true }) {
  const [showComments, setShowComments] = useState(false);
  const groups = groupLines(workout.exercises);
  const hidden = groups.length - MAX_GROUPS;

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 px-4 pt-4">
        {showAuthor && (
          <Link to={`/profil/${workout.user.username}`} className="shrink-0">
            <Avatar username={workout.user.username} />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          {showAuthor && (
            <Link
              to={`/profil/${workout.user.username}`}
              className="font-semibold text-zinc-100 hover:underline"
            >
              {workout.user.username}
            </Link>
          )}
          <p className="truncate text-xs text-zinc-500">
            {formatDay(workout.workout_date)}
            {workout.validated_at && ` · publiée ${timeAgo(workout.validated_at)}`}
          </p>
        </div>
        {workout.pr_count > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
            <Trophy className="size-3.5" />
            {plural(workout.pr_count, 'record')}
          </span>
        )}
      </header>

      <Link to={`/seance/${workout.id}`} className="block px-4 pt-3 pb-4">
        <h3 className="text-lg leading-snug font-bold text-white">{autoTitle(workout)}</h3>
        {workout.notes && (
          <p className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-zinc-400">{workout.notes}</p>
        )}

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Volume" value={formatVolume(workout.totals.total_volume)} accent />
          <Stat label="Séries" value={workout.totals.total_sets} />
          <Stat label="Exercices" value={workout.totals.exercise_count} />
        </div>

        <ul className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
          {groups.slice(0, MAX_GROUPS).map((group) => (
            <li key={group.exercise_id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="flex max-w-full min-w-0 items-center gap-1.5 text-zinc-200">
                {group.is_pr && <Trophy className="size-3.5 shrink-0 text-amber-300" />}
                <span className="truncate">{group.name}</span>
              </span>
              <span className="tabular ml-auto text-right text-xs text-zinc-400">
                {summarizeGroup(group)}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="text-xs text-zinc-500">+ {plural(hidden, 'autre exercice', 'autres exercices')}</li>
          )}
        </ul>
      </Link>

      <footer className="flex items-center gap-1 border-t border-zinc-800 px-2 py-1.5">
        <KudosButton workout={workout} />
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-zinc-800 ${
            showComments ? 'text-zinc-100' : 'text-zinc-400'
          }`}
        >
          <MessageCircle className="size-5" />
          <span className="tabular">{workout.comments_count}</span>
          <span className="hidden sm:inline">Commentaires</span>
        </button>
        <div className="ml-auto min-w-0 pr-2">
          <KudosSummary kudos={workout.kudos} />
        </div>
      </footer>

      {showComments && (
        <div className="border-t border-zinc-800 bg-zinc-950/40 p-4">
          <CommentsSection workout={workout} autoFocus />
        </div>
      )}
    </article>
  );
}
