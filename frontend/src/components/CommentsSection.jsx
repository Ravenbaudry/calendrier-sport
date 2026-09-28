import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SendHorizontal, Trash2 } from 'lucide-react';
import { del, get, post } from '../api/client.js';
import { timeAgo } from '../lib/format.js';
import { patchWorkoutInCaches } from '../lib/workouts.js';
import Avatar from './Avatar.jsx';
import { ErrorMessage, Spinner } from './ui.jsx';

export default function CommentsSection({ workout, autoFocus = false }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const key = ['comments', workout.id];

  const { data, isPending, error } = useQuery({
    queryKey: key,
    queryFn: () => get(`/workouts/${workout.id}/comments`),
  });

  const bumpCount = (delta) =>
    patchWorkoutInCaches(queryClient, workout.id, (w) => ({
      ...w,
      comments_count: w.comments_count + delta,
    }));

  const addComment = useMutation({
    mutationFn: (text) => post(`/workouts/${workout.id}/comments`, { content: text }),
    onSuccess: ({ comment }) => {
      queryClient.setQueryData(key, (old) => ({ items: [...(old?.items ?? []), comment] }));
      bumpCount(1);
      setContent('');
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId) => del(`/comments/${commentId}`),
    onSuccess: (_data, commentId) => {
      queryClient.setQueryData(key, (old) => ({
        items: (old?.items ?? []).filter((c) => c.id !== commentId),
      }));
      bumpCount(-1);
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (content.trim()) addComment.mutate(content.trim());
  };

  return (
    <div className="space-y-3">
      {isPending && (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      )}
      <ErrorMessage error={error || deleteComment.error} />

      {data?.items.length === 0 && (
        <p className="py-1 text-sm text-zinc-500">Aucun commentaire. Lance la discussion !</p>
      )}

      <ul className="space-y-3">
        {data?.items.map((comment) => (
          <li key={comment.id} className="group flex gap-2.5">
            <Link to={`/profil/${comment.user.username}`}>
              <Avatar username={comment.user.username} size="sm" />
            </Link>
            <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-zinc-800/70 px-3.5 py-2">
              <div className="flex items-baseline gap-2">
                <Link
                  to={`/profil/${comment.user.username}`}
                  className="text-sm font-semibold text-zinc-100 hover:underline"
                >
                  {comment.user.username}
                </Link>
                <span className="text-xs text-zinc-500">{timeAgo(comment.created_at)}</span>
              </div>
              <p className="text-sm break-words whitespace-pre-line text-zinc-300">{comment.content}</p>
            </div>
            {(comment.is_author || workout.is_owner) && (
              <button
                type="button"
                className="btn-icon self-center opacity-60 group-hover:opacity-100"
                aria-label="Supprimer le commentaire"
                onClick={() => {
                  if (window.confirm('Supprimer ce commentaire ?')) deleteComment.mutate(comment.id);
                }}
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          rows={1}
          maxLength={1000}
          autoFocus={autoFocus}
          placeholder="Ajouter un commentaire…"
          className="input max-h-32 min-h-11 resize-none"
        />
        <button
          type="submit"
          className="btn-primary size-11 shrink-0 p-0"
          disabled={!content.trim() || addComment.isPending}
          aria-label="Envoyer"
        >
          {addComment.isPending ? <Spinner className="size-4 text-white" /> : <SendHorizontal className="size-5" />}
        </button>
      </form>
      <ErrorMessage error={addComment.error} />
    </div>
  );
}
