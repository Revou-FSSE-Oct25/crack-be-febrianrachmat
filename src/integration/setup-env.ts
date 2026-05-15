import 'dotenv/config';

const resolvedDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!resolvedDatabaseUrl) {
  throw new Error(
    'Missing TEST_DATABASE_URL (or DATABASE_URL) for integration tests.',
  );
}

process.env.DATABASE_URL = resolvedDatabaseUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret';
/** Disable SLA cron during integration tests (real DB, long-running suite). */
process.env.CONSULTATION_SLA_CRON = 'false';
/** Global rate limit off during integration tests (many sequential HTTP calls). */
process.env.DISABLE_THROTTLE = 'true';
