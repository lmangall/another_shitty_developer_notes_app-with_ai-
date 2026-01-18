You are helping with a database task. First, load the context by:

1. Reading the database schema at `src/db/schema.ts`
2. Understanding the current database structure

## Database Commands Reference

**Drizzle ORM:**
- `npm run db:generate` - Generate migration from schema changes
- `npm run db:migrate` - Run pending migrations
- `npm run db:push` - Push schema directly (dev only, no migration)
- `npm run db:studio` - Open Drizzle Studio GUI

**Neon Serverless:**
- Connection: Uses `@neondatabase/serverless`
- Check `.env.local` for `DATABASE_URL`

**IMPORTANT:**
- NEVER run destructive commands without explicit user confirmation
- Always create migrations for production changes
- Use `db:push` only in development

Now help with: $ARGUMENTS
