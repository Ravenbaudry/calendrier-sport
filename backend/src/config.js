// Configuration centralisée, lue depuis les variables d'environnement.

const env = process.env;

function required(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

// Connexion PostgreSQL : DATABASE_URL, ou à défaut les variables standard PGHOST, PGUSER,
// PGPASSWORD, PGDATABASE lues directement par node-postgres (aucun souci d'échappement
// si le mot de passe contient des caractères spéciaux).
if (!env.DATABASE_URL && !env.PGHOST) {
  throw new Error('Configure DATABASE_URL ou PGHOST/PGUSER/PGPASSWORD/PGDATABASE');
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 caractères (openssl rand -hex 32)');
}

export const config = {
  env: env.NODE_ENV ?? 'development',
  port: Number(env.PORT ?? 3000),
  databaseUrl: env.DATABASE_URL || undefined,
  // Fuseau utilisé pour « aujourd'hui », les classements 7/30 jours, etc.
  timezone: env.TZ ?? 'Europe/Paris',
  jwt: {
    secret: jwtSecret,
    expiresIn: env.JWT_EXPIRES_IN ?? '30d',
  },
  bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 12),
  // Si défini, un code d'invitation est exigé à l'inscription.
  inviteCode: env.INVITE_CODE || null,
  // Nombre de proxys de confiance devant l'API (nginx = 1) pour l'IP réelle du client.
  trustProxy: Number(env.TRUST_PROXY ?? 1),
};
