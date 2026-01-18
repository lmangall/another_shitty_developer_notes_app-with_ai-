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
  trustedProxyOrigins: true,
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
  trustedOrigins: (request) => {
    const origin = request?.headers.get('origin');
    const origins: string[] = [
      'http://localhost:3000',
      process.env.BETTER_AUTH_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_BRANCH_URL
        ? `https://${process.env.VERCEL_BRANCH_URL}`
        : null,
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null,
    ].filter((o): o is string => Boolean(o));

    // Dynamically add the current origin if it's a Vercel preview URL
    if (origin?.endsWith('.vercel.app') && !origins.includes(origin)) {
      origins.push(origin);
    }

    return origins;
  },
});

export type Session = typeof auth.$Infer.Session;
