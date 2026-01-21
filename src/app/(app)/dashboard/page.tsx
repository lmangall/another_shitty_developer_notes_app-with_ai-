'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PushNotificationSettings } from '@/components/push-notifications';
import { format, formatDistanceToNow } from 'date-fns';

interface DashboardStats {
  totalNotes: number;
  pendingReminders: number;
  totalReminders: number;
  totalLogs: number;
  failedLogs: number;
}

interface RecentNote {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface UpcomingReminder {
  id: string;
  message: string;
  remindAt: string | null;
  status: string;
}

interface RecentLog {
  id: string;
  fromEmail: string;
  subject: string | null;
  actionType: string | null;
  status: string;
  createdAt: string;
}

interface DashboardData {
  stats: DashboardStats;
  recentNotes: RecentNote[];
  upcomingReminders: UpcomingReminder[];
  recentLogs: RecentLog[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const dashboardData: DashboardData = await res.json();
      setData(dashboardData);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
          <p>Failed to load dashboard data.</p>
        </div>
      </div>
    );
  }

  const { recentNotes, upcomingReminders, recentLogs } = data;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Recent Notes and Upcoming Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Notes</CardTitle>
            <Link href="/notes">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentNotes.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No notes yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentNotes.map((note) => (
                  <Link key={note.id} href={`/notes/${note.id}`}>
                    <div className="flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors">
                      <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{note.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {note.content}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Reminders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Reminders</CardTitle>
            <Link href="/reminders">
              <Button variant="ghost" size="sm" className="gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingReminders.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                No pending reminders
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/30"
                  >
                    <Clock className="h-4 w-4 mt-0.5 text-yellow-500" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-2">{reminder.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {reminder.remindAt
                          ? format(new Date(reminder.remindAt), 'MMM d, yyyy h:mm a')
                          : 'No time set'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Push Notifications */}
      <PushNotificationSettings />

      {/* Recent Email Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Email Logs</CardTitle>
          <Link href="/logs">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              No email logs yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors"
                >
                  {log.status === 'processed' && (
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                  {log.status === 'pending' && (
                    <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  {log.status === 'failed' && (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {log.subject || log.fromEmail}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {log.actionType && (
                        <span className="capitalize">{log.actionType.replace('_', ' ')}</span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      log.status === 'processed'
                        ? 'bg-green-500/10 text-green-500'
                        : log.status === 'pending'
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
