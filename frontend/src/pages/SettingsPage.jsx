import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, KeyRound, LogOut, UserRound } from 'lucide-react';
import { patch, put } from '../api/client.js';
import Avatar from '../components/Avatar.jsx';
import { ErrorMessage, PageHeader, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsPage() {
  const { user, setUser, logout, applySession } = useAuth();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(user.bio ?? '');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState(null);

  const saveProfile = useMutation({
    mutationFn: () => patch('/users/me', { bio }),
    onSuccess: ({ user: updated }) => {
      setUser((u) => ({ ...u, ...updated }));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      put('/auth/password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    onSuccess: (session) => {
      applySession(session);
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
    },
  });

  const submitPassword = (e) => {
    e.preventDefault();
    setPasswordError(null);
    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError(new Error('Les nouveaux mots de passe ne correspondent pas'));
      return;
    }
    changePassword.mutate();
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Réglages" />

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
          <UserRound className="size-4 text-brand-400" /> Profil
        </h2>
        <div className="mb-4 flex items-center gap-3">
          <Avatar username={user.username} size="lg" />
          <div>
            <div className="font-semibold text-zinc-100">{user.username}</div>
            <Link to={`/profil/${user.username}`} className="text-sm text-brand-400 hover:underline">
              Voir mon profil public
            </Link>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveProfile.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="label" htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              className="input min-h-20"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={280}
              placeholder="Objectifs, programme suivi, salle…"
            />
            <div className="mt-1 text-right text-xs text-zinc-500">{bio.length}/280</div>
          </div>
          <ErrorMessage error={saveProfile.error} />
          <button type="submit" className="btn-primary" disabled={saveProfile.isPending}>
            {saveProfile.isPending ? <Spinner className="size-4 text-white" /> : <Check className="size-4" />}
            {saveProfile.isSuccess ? 'Enregistré' : 'Enregistrer'}
          </button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-white">
          <KeyRound className="size-4 text-brand-400" /> Mot de passe
        </h2>
        <form onSubmit={submitPassword} className="space-y-3">
          <input type="text" autoComplete="username" value={user.username} readOnly hidden />
          <div>
            <label className="label" htmlFor="current-password">Mot de passe actuel</label>
            <input
              id="current-password"
              type="password"
              className="input"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new-password">Nouveau</label>
              <input
                id="new-password"
                type="password"
                className="input"
                autoComplete="new-password"
                minLength={8}
                value={passwords.newPassword}
                onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm-password">Confirmation</label>
              <input
                id="confirm-password"
                type="password"
                className="input"
                autoComplete="new-password"
                minLength={8}
                value={passwords.confirm}
                onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
                required
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">Changer de mot de passe déconnecte tes autres appareils.</p>
          <ErrorMessage error={passwordError || changePassword.error} />
          {changePassword.isSuccess && <p className="text-sm text-emerald-400">Mot de passe modifié ✔</p>}
          <button type="submit" className="btn-secondary" disabled={changePassword.isPending}>
            {changePassword.isPending && <Spinner className="size-4" />}
            Changer le mot de passe
          </button>
        </form>
      </section>

      <button type="button" className="btn-danger w-full py-3" onClick={logout}>
        <LogOut className="size-4" /> Se déconnecter
      </button>
    </div>
  );
}
