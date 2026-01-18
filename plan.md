# Note-Taking App - Technical Specifications

## Overview
A Next.js-based note-taking application with email integration, AI processing, and reminder functionality.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Database**: Neon (Serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **Authentication**: Better Auth
- **Email**: Resend (inbound + outbound)
- **AI**: Vercel AI SDK (Claude 3.5 Sonnet)
- **Deployment**: Vercel
- **Styling**: TBD (Tailwind CSS recommended)

## Core Features

### 1. Authentication
- Better Auth with email magic links
- Uses Resend for sending login emails
- Single user or multi-user support

### 2. Email → Note Pipeline
- User sends email to unique address (e.g., `user-id@yourdomain.com`)
- Resend webhook receives email
- AI processes email body into markdown note
- Extracts title and formatted content
- Saves to database
- Logs email processing in audit log

### 3. Email → Reminder Pipeline
- User sends email with reminder request
- AI detects intent (note vs reminder)
- Extracts reminder message and datetime
- Creates reminder in database
- Vercel Cron job checks hourly for due reminders
- Sends reminder email via Resend when time arrives

### 4. Web UI - Notes
- List all notes (paginated)
- View individual note (markdown rendered)
- Create note manually
- Edit note (markdown editor or textarea)
- Delete note
- Simple text search

### 5. Web UI - Reminders
- List upcoming reminders
- Create reminder manually
- View reminder details
- Cancel/reschedule reminders
- Mark as complete

### 6. Email Audit Log
- List all processed emails
- View email details:
  - Original email content
  - AI extraction result (JSON)
  - Link to created note/reminder
  - Error logs (if any)
- Reprocess failed emails
- Delete email logs

### 7. Web UI - Text/Voice Input
- Text input field in frontend (same capabilities as email)
- Uses native browser Web Speech API for voice input
- AI processes input to determine intent and execute actions:
  - **Create note** - "Create a note about..."
  - **Edit note** - "Update my note titled X to..."
  - **Delete note** - "Delete the note about..."
  - **Create reminder** - "Remind me to..."
  - **Cancel reminder** - "Cancel my reminder about..."
- Shared AI processing pipeline with email (same intent detection + action execution)

### 8. Extended Email Actions
- Email can trigger same actions as text/voice input:
  - Create note (existing)
  - Create reminder (existing)
  - Edit existing note
  - Delete note
  - Cancel/modify reminder
- AI detects action type from email content

### Inbound Email
1. Configure custom domain in Resend
2. Set up inbound routing to webhook URL
3. Email format: `{user-id}@notes.yourdomain.com`

### Outbound Email
- Login magic links (Better Auth)
- Reminder emails
- Confirmation emails (optional)

## Vercel Cron Jobs

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Cron Logic:**
1. Query reminders where `status = 'pending'` AND `remind_at <= NOW()`
2. For each reminder:
   - Send email via Resend
   - Update status to 'sent'
   - Log any errors

## Environment Variables

## TODOs / Future Decisions

- [ ] **Reminder datetime handling:**
  - What if `remind_at` is null?
  - What if datetime is in the past?
  - Timezone strategy (default to UTC? user preference?)
  
- [ ] **Recurring reminders:**
  - Support "every Monday" type reminders?
  - Store recurrence rule or create new reminder after sending?
  
- [ ] **Email confirmation:**
  - Send confirmation email after processing?
  - Include link to created note/reminder?
  
- [ ] **Error handling:**
  - Retry failed AI processing?
  - Alert user of failed emails?
  
- [ ] **Search:**
  - Full-text search implementation
  - Search in note content or just titles?
  
- [ ] **Markdown editor:**
  - Simple textarea or rich markdown editor?
  - Preview mode?

- [ ] **Text/Voice Input:**
  - Confirmation before destructive actions (delete)?
  - Show AI's interpretation before executing?
  - Voice feedback using Web Speech synthesis?

- [ ] **Note identification for edit/delete:**
  - Match by title (fuzzy matching)?
  - Show disambiguation if multiple matches?
  - Reference by ID or recent notes list?

## Security Considerations

1. **Webhook verification:** Validate Resend webhook signatures
2. **Rate limiting:** Prevent abuse of email endpoint
3. **User isolation:** Ensure users can only access their own data
4. **Input sanitization:** Sanitize markdown before rendering
5. **Email validation:** Verify email sender matches authenticated user

## Performance Optimizations

1. **Database:**
   - Proper indexes on frequently queried columns
   - Connection pooling with Neon
   
2. **UI:**
   - Paginate notes list
   - Lazy load email logs
   - Optimize markdown rendering
   
3. **Caching:**
   - Cache rendered markdown (optional)
   - Use Next.js caching strategies






If more info is needed for better auth:
 https://better-auth.com/llms.txt.