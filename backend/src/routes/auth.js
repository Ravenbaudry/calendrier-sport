import { Router } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, conflict, forbidden, unauthorized } from '../middleware/errors.js';
import { changePasswordSchema, loginSchema, registerSchema } from '../validation.js';

export const authRouter = Router();

// Anti brute-force : 20 tentatives / 15 min / IP sur les routes sensibles.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessaie dans quelques minutes' },
});

// Hash factice : un login sur un pseudo inconnu coûte autant qu'un vrai (pas d'énumération par timing).
const DUMMY_HASH = bcrypt.hashSync('calendrier-sport-dummy-password', config.bcryptRounds);

const publicUser = ({ id, username, bio, created_at }) => ({ id, username, bio, created_at });

function inviteCodeMatches(provided) {
  const expected = Buffer.from(config.inviteCode);
  const given = Buffer.from(provided ?? '');
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// Indique au frontend si un code d'invitation est requis.
authRouter.get('/config', (req, res) => {
  res.json({ inviteRequired: Boolean(config.inviteCode) });
});

authRouter.post('/register', authLimiter, async (req, res) => {
  const { username, password, inviteCode } = registerSchema.parse(req.body);

  if (config.inviteCode && !inviteCodeMatches(inviteCode)) {
    throw forbidden("Code d'invitation incorrect");
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  try {
    const { rows } = await query(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, bio, token_version, created_at`,
      [username, passwordHash],
    );
    const user = rows[0];
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') throw conflict('Ce pseudo est déjà pris');
    throw err;
  }
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);

  const { rows } = await query(
    `SELECT id, username, bio, password_hash, token_version, created_at
     FROM users WHERE lower(username) = lower($1)`,
    [username],
  );
  const user = rows[0];
  const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw unauthorized('Pseudo ou mot de passe incorrect');
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// Changement de mot de passe : révoque toutes les sessions et renvoie un nouveau jeton.
authRouter.put('/password', requireAuth, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw badRequest('Mot de passe actuel incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);
  const { rows: updated } = await query(
    `UPDATE users SET password_hash = $2, token_version = token_version + 1
     WHERE id = $1
     RETURNING id, username, bio, token_version, created_at`,
    [req.user.id, passwordHash],
  );
  res.json({ token: signToken(updated[0]), user: publicUser(updated[0]) });
});
