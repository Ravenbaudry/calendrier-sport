import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { query } from './db.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { exercisesRouter } from './routes/exercises.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { socialRouter } from './routes/social.js';
import { usersRouter } from './routes/users.js';
import { workoutsRouter } from './routes/workouts.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(express.json({ limit: '200kb' }));

  if (config.env !== 'test') {
    app.use((req, res, next) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
      });
      next();
    });
  }

  app.get('/api/health', async (req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter); // register/login publics, /me et /password protégés

  // Tout le reste de l'API exige un JWT valide.
  app.use('/api', requireAuth);
  app.use('/api/users', usersRouter);
  app.use('/api/exercises', exercisesRouter);
  app.use('/api/workouts', workoutsRouter);
  app.use('/api/leaderboard', leaderboardRouter);
  app.use('/api', socialRouter); // /api/feed, /api/workouts/:id/kudos|comments, /api/comments/:id

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
