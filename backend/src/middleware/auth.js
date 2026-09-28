import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { unauthorized } from './errors.js';

export function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, ver: user.token_version },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' },
  );
}

// Vérifie le header « Authorization: Bearer <jwt> » et charge l'utilisateur dans req.user.
// L'utilisateur est relu en base : un compte supprimé ou un mot de passe changé
// (token_version incrémenté) invalide immédiatement les anciens jetons.
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized();
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Session expirée ou invalide, reconnecte-toi');
  }

  const { rows } = await query(
    'SELECT id, username, bio, token_version, created_at FROM users WHERE id = $1',
    [Number(payload.sub)],
  );
  const user = rows[0];
  if (!user || user.token_version !== payload.ver) {
    throw unauthorized('Session expirée ou invalide, reconnecte-toi');
  }

  req.user = user;
  next();
}
