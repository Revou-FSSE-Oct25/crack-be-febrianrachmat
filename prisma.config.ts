import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // URL tetap dari `prisma/schema.prisma` (`env("DATABASE_URL")`).
  // Jangan duplikasi di sini: duplikat bisa membuat `prisma generate` di build
  // (mis. Railway tanpa secret saat install) gagal walau generate tidak butuh DB nyata.
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
});

