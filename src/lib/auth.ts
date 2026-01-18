import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/db';
import { users, sessions, accounts, verifications } from '@/db/schema';
import { Resend } from 'resend';

function getResend() {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const resend = getResend();
      if (resend) {
        await resend.emails.send({
          from: `Notes App <noreply@${process.env.EMAIL_DOMAIN}>`,
          to: user.email,
          subject: 'Verify your email',
          html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
        });
      }
    },
  },
  socialProviders: {},
  trustedOrigins: [
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : null,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    'http://localhost:3000',
    /\.vercel\.app$/,
  ].filter(Boolean) as string[],
});

export type Session = typeof auth.$Infer.Session;
