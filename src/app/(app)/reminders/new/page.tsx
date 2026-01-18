'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { NOTIFY_VIA_OPTIONS, type NotifyVia } from '@/lib/constants';

export default function NewReminderPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [notifyVia, setNotifyVia] = useState<NotifyVia>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCalendarMobile, setShowCalendarMobile] = useState(false);

  // Combine date and time into ISO string for submission
  const getRemindAtValue = () => {
    if (!selectedDate) return null;
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const combined = new Date(selectedDate);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

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
          remindAt: getRemindAtValue(),
          notifyVia,
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

            <div className="space-y-3">
              <Label>Remind At (optional)</Label>

              {/* Mobile: Collapsible calendar */}
              <div className="md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => setShowCalendarMobile(!showCalendarMobile)}
                >
                  <span>
                    {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
                  </span>
                  {showCalendarMobile ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
                {showCalendarMobile && (
                  <div className="mt-2 rounded-md border bg-card p-2">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    />
                  </div>
                )}
              </div>

              {/* Desktop: Always visible calendar */}
              <div className="hidden md:block rounded-md border bg-card">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="mx-auto"
                />
              </div>

              {/* Time input - show when date is selected */}
              {selectedDate && (
                <div className="flex items-center gap-3">
                  <Label htmlFor="time" className="shrink-0">
                    Time:
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">
                    {format(selectedDate, 'EEE, MMM d')} at {selectedTime}
                  </span>
                </div>
              )}

              {/* Clear button */}
              {selectedDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate(undefined)}
                  className="text-muted-foreground"
                >
                  Clear date
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notifyVia">Notify Via</Label>
              <div className="flex gap-2">
                {NOTIFY_VIA_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={notifyVia === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNotifyVia(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {notifyVia === 'push' && 'Make sure push notifications are enabled in settings.'}
                {notifyVia === 'both' && 'You will receive both email and push notification.'}
                {notifyVia === 'email' && 'You will receive an email reminder.'}
              </p>
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
