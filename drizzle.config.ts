import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` turns schema changes into a SQL migration in src/db/migrations, bundled
// into the app (babel inline-import + Metro `sql` extension) and applied at startup.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  out: './src/db/migrations',
  schema: './src/db/schema.ts',
});
