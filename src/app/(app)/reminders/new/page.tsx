'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function NewReminderPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Message is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          remindAt: remindAt || null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create reminder');
      }

      router.push('/reminders');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/reminders"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Reminders
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold text-foreground">Create New Reminder</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="What do you want to be reminded about?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remindAt">Remind At (optional)</Label>
              <Input
                id="remindAt"
                type="datetime-local"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/reminders">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Reminder'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
