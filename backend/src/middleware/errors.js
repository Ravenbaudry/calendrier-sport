import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, details);
export const unauthorized = (message = 'Authentification requise') => new HttpError(401, message);
export const forbidden = (message = 'Action non autorisée') => new HttpError(403, message);
export const notFound = (message = 'Ressource introuvable') => new HttpError(404, message);
export const conflict = (message) => new HttpError(409, message);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.originalUrl}` });
}

// Gestionnaire d'erreurs global (Express 5 transmet aussi les rejets de promesses).
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // JSON mal formé envoyé par le client
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse' });
  }
  // Violations de contraintes PostgreSQL remontées telles quelles
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Cette ressource existe déjà' });
  }
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Ressource liée introuvable ou encore utilisée' });
  }
  if (err.code === '23514' || err.code === '22P02' || err.code === '22003') {
    return res.status(400).json({ error: 'Valeur hors limites ou invalide' });
  }

  console.error(`[api] ${req.method} ${req.originalUrl}`, err);
  return res.status(500).json({ error: 'Erreur interne du serveur' });
}
