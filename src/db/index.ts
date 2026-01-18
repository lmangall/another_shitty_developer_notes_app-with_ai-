import { drizzle } from 'drizzle-orm/neon-http';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import * as schema from './schema';

let sql: NeonQueryFunction<boolean, boolean> | null = null;

function getSQL() {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    sql = neon(process.env.DATABASE_URL);
  }
  return sql;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(target, prop) {
    const instance = drizzle(getSQL(), { schema });
    return Reflect.get(instance, prop);
  },
});

export * from './schema';
