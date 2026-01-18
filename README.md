# Notes App (Developer Playground)

A personal sandbox for experimenting with APIs, tools, and integrations. Built around one simple idea: **speak into your phone → get structured notes**.

## Why This Exists

Two things I really wanted:

1. **Voice → structured output.** Ramble into my phone or desktop, get clean bullet points. Markdown is perfect for this—one note is just one string in the database and that's it.

2. **Email → database.** I built this for a client first (their version is more advanced), but having my own is magic: send an email, AI processes it, database updated.

The rest grew and will grew from there as a place to try new things—connecting services, testing APIs, experimenting with tools.
I am also happy I can ramble to claude code when the repo is open, and it'll just create the content in DB.
Side note: I use Superwhisper

## Entry Points

Multiple ways to create notes, all processed by AI:

- **Claude Code** — prompt from the terminal while in the repo
- **Email** — send to the server (webhook signature verification so only real emails get processed, plus sender whitelist)
- **Voice** — quick create button with speech recognition
- **Form** — the old-fashioned way, if you're not too lazy

## Features

**Reminders**
- Natural language: "remind me to call mom tomorrow at 5pm"
- Notifications via email, push, or both

**Push Notifications**
- Web Push API with VAPID
- Works on mobile browsers

**The Basics**
- Notes with tags and markdown
- Dashboard with stats

## Cron & Free Tier Constraints

Reminders need periodic checks. Options considered:
- **Vercel Cron** — limited to 1/day on free tier
- **GitHub Actions** — could ping every 5 minutes, but running a GitHub Action just to hit a Vercel URL feels overkill

Solution: **UptimeRobot** pings `/api/cron/check-reminders` for free. It's meant for uptime monitoring, but works perfectly for triggering the cron job.

## Tech Stack

- Next.js 16 + React 19
- Drizzle ORM + Neon PostgreSQL
- Better Auth (email + Google OAuth)
- Vercel AI SDK + Sonnet (could swap for cheaper models easily)
- Resend (email + webhooks)
- Web Push API
