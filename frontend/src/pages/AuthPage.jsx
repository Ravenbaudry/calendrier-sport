import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Flame, LogIn, Trophy, UserPlus } from 'lucide-react';
import { get } from '../api/client.js';
import { Logo } from '../components/Layout.jsx';
import { ErrorMessage, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  { icon: CalendarDays, text: 'Ton journal de muscu, jour après jour' },
  { icon: Flame, text: 'Kudos et commentaires entre potes' },
  { icon: Trophy, text: 'Classements volume & régularité' },
];

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '', confirm: '', inviteCode: '' });
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);

  const { data: authConfig } = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => get('/auth/config'),
    enabled: isRegister,
  });

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (isRegister && form.password !== form.confirm) {
      setError(new Error('Les mots de passe ne correspondent pas'));
      return;
    }
    setPending(true);
    try {
      if (isRegister) await register(form.username.trim(), form.password, form.inviteCode.trim() || undefined);
      else await login(form.username.trim(), form.password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(251,106,31,0.18),transparent_60%)] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo />
          <p className="mt-3 text-sm text-zinc-400">Le Strava de la muscu, entre amis.</p>
        </div>

        <div className="card p-6">
          <h1 className="mb-5 text-xl font-bold text-white">{isRegister ? 'Créer un compte' : 'Connexion'}</h1>
          <form className="space-y-4" onSubmit={submit}>
            <div>
              <label className="label" htmlFor="username">Pseudo</label>
              <input
                id="username"
                className="input"
                value={form.username}
                onChange={update('username')}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                minLength={isRegister ? 3 : 1}
                maxLength={30}
                pattern={isRegister ? '[A-Za-z0-9_.\\-]{3,30}' : undefined}
                title="3 à 30 caractères : lettres, chiffres, _ . -"
                autoFocus
              />
            </div>
            <div>
              <label className="label" htmlFor="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                className="input"
                value={form.password}
                onChange={update('password')}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 8 : 1}
              />
            </div>
            {isRegister && (
              <>
                <div>
                  <label className="label" htmlFor="confirm">Confirmation</label>
                  <input
                    id="confirm"
                    type="password"
                    className="input"
                    value={form.confirm}
                    onChange={update('confirm')}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                </div>
                {authConfig?.inviteRequired && (
                  <div>
                    <label className="label" htmlFor="invite">Code d'invitation</label>
                    <input
                      id="invite"
                      className="input"
                      value={form.inviteCode}
                      onChange={update('inviteCode')}
                      autoComplete="off"
                      required
                      placeholder="Demande-le à l'admin du serveur"
                    />
                  </div>
                )}
              </>
            )}

            <ErrorMessage error={error} />

            <button type="submit" className="btn-primary w-full py-3" disabled={pending}>
              {pending ? (
                <Spinner className="size-4 text-white" />
              ) : isRegister ? (
                <UserPlus className="size-4" />
              ) : (
                <LogIn className="size-4" />
              )}
              {isRegister ? "S'inscrire" : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-zinc-400">
          {isRegister ? 'Déjà inscrit ?' : 'Pas encore de compte ?'}{' '}
          <Link to={isRegister ? '/connexion' : '/inscription'} className="font-semibold text-brand-400 hover:underline">
            {isRegister ? 'Se connecter' : 'Créer un compte'}
          </Link>
        </p>

        <ul className="mt-8 space-y-2.5">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-zinc-400">
              <Icon className="size-4 text-brand-500" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
