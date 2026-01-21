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
import { NOTIFY_VIA_OPTIONS, RECURRENCE_OPTIONS, type NotifyVia, type Recurrence } from '@/lib/constants';
import { createReminder } from '@/actions/reminders';

export default function NewReminderPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [notifyVia, setNotifyVia] = useState<NotifyVia>('email');
  const [recurrence, setRecurrence] = useState<Recurrence>('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
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
      const result = await createReminder({
        message,
        remindAt: getRemindAtValue() ?? undefined,
        notifyVia,
        recurrence: recurrence || undefined,
        recurrenceEndDate: recurrenceEndDate?.toISOString(),
      });

      if (!result.success) {
        throw new Error(result.error);
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
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 mb-4 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Desktop: Two-column layout */}
            <div className="hidden md:flex gap-6">
              {/* Left: Calendar */}
              <div className="shrink-0">
                <Label className="mb-2 block">Remind At (optional)</Label>
                <div className="rounded-md border bg-card">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </div>
                {selectedDate && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-28"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(undefined)}
                      className="text-muted-foreground text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Right: Message + Notify Via */}
              <div className="flex-1 flex flex-col">
                <div className="space-y-2 flex-1 flex flex-col">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="What do you want to be reminded about?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="flex-1 min-h-[120px] resize-none"
                    required
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Notify Via</Label>
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
                    {notifyVia === 'push' && 'Push notifications must be enabled.'}
                    {notifyVia === 'both' && 'Email and push notification.'}
                    {notifyVia === 'email' && 'Email reminder.'}
                  </p>
                </div>

                <div className="space-y-2 mt-4">
                  <Label>Repeat</Label>
                  <div className="flex gap-2 flex-wrap">
                    {RECURRENCE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={recurrence === option.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setRecurrence(option.value);
                          if (!option.value) setRecurrenceEndDate(undefined);
                        }}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                  {recurrence && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-muted-foreground">End date (optional):</span>
                      <Input
                        type="date"
                        value={recurrenceEndDate ? format(recurrenceEndDate, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setRecurrenceEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                        className="w-40"
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                      {recurrenceEndDate && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setRecurrenceEndDate(undefined)}
                          className="text-muted-foreground text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {selectedDate && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Scheduled: {format(selectedDate, 'EEE, MMM d')} at {selectedTime}
                  </p>
                )}

                <div className="flex justify-end gap-3 mt-4">
                  <Link href="/reminders">
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Reminder'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile: Stacked layout */}
            <div className="md:hidden space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message-mobile">Message</Label>
                <Textarea
                  id="message-mobile"
                  placeholder="What do you want to be reminded about?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Remind At (optional)</Label>
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
                  <div className="mt-2">
                    <div className="rounded-md border bg-card inline-block">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </div>
                  </div>
                )}
                {selectedDate && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">
                      {format(selectedDate, 'EEE, MMM d')}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(undefined)}
                      className="text-muted-foreground text-xs ml-auto"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notify Via</Label>
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
              </div>

              <div className="space-y-2">
                <Label>Repeat</Label>
                <div className="flex gap-2 flex-wrap">
                  {RECURRENCE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={recurrence === option.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setRecurrence(option.value);
                        if (!option.value) setRecurrenceEndDate(undefined);
                      }}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                {recurrence && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-muted-foreground">End:</span>
                    <Input
                      type="date"
                      value={recurrenceEndDate ? format(recurrenceEndDate, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setRecurrenceEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                      className="flex-1"
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                )}
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
