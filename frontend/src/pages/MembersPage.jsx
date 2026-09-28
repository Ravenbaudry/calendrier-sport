import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { get } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import { ErrorMessage, PageHeader, PageLoader } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDay, plural } from '../lib/format.js';

export default function MembersPage() {
  const { user: me } = useAuth();
  const { data, isPending, error } = useQuery({ queryKey: ['members'], queryFn: () => get('/users') });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Membres"
        subtitle={data ? `${plural(data.items.length, 'athlète')} sur ce serveur` : undefined}
      />
      {isPending && <PageLoader />}
      <ErrorMessage error={error} />
      {data && (
        <ul className="card divide-y divide-zinc-800 overflow-hidden">
          {data.items.map((member) => (
            <li key={member.id}>
              <Link
                to={`/profil/${member.username}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/50"
              >
                <Avatar username={member.username} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-zinc-100">
                    {member.username}
                    {member.id === me.id && <span className="ml-2 text-xs font-medium text-brand-400">(toi)</span>}
                  </div>
                  <div className="truncate text-xs text-zinc-500">
                    {plural(member.workouts_count, 'séance')}
                    {member.last_workout_date &&
                      ` · dernière : ${formatDay(member.last_workout_date, { weekday: false }).toLowerCase()}`}
                  </div>
                </div>
                <ChevronRight className="size-4 text-zinc-600" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
