'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Bell, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface Reminder {
  id: string;
  message: string;
  remindAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface RemindersResponse {
  reminders: Reminder[];
  total: number;
  page: number;
  totalPages: number;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={16} className="text-yellow-500" />,
  sent: <CheckCircle size={16} className="text-green-500" />,
  cancelled: <XCircle size={16} className="text-gray-400" />,
  completed: <CheckCircle size={16} className="text-blue-500" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  sent: 'bg-green-50 text-green-700',
  cancelled: 'bg-gray-50 text-gray-600',
  completed: 'bg-blue-50 text-blue-700',
};

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');

  useEffect(() => {
    fetchReminders();
  }, [page, filter]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (filter) params.set('status', filter);

      const res = await fetch(`/api/reminders?${params}`);
      const data: RemindersResponse = await res.json();
      setReminders(data.reminders);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchReminders();
    } catch (error) {
      console.error('Failed to update reminder:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Reminders</h1>
        <Link href="/reminders/new">
          <Button>
            <Plus size={20} className="mr-2" />
            New Reminder
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-6">
        {['', 'pending', 'sent', 'completed', 'cancelled'].map((status) => (
          <Button
            key={status}
            variant={filter === status ? 'default' : 'secondary'}
            size="sm"
            onClick={() => {
              setFilter(status);
              setPage(1);
            }}
          >
            {status || 'All'}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bell size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reminders yet. Create your first reminder!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => (
            <Card key={reminder.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {statusIcons[reminder.status]}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColors[reminder.status]}`}
                      >
                        {reminder.status}
                      </span>
                    </div>
                    <p className="text-foreground mb-2">{reminder.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {reminder.remindAt
                        ? `Remind at: ${format(new Date(reminder.remindAt), 'MMM d, yyyy h:mm a')}`
                        : 'No time set'}
                    </p>
                  </div>

                  {reminder.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(reminder.id, 'completed')}
                      >
                        Complete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateStatus(reminder.id, 'cancelled')}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
