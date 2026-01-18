'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCw, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

interface EmailLog {
  id: string;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  body: string;
  aiResult: Record<string, unknown> | null;
  actionType: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: EmailLog[];
  total: number;
  page: number;
  totalPages: number;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={16} className="text-yellow-500" />,
  processed: <CheckCircle size={16} className="text-green-500" />,
  failed: <XCircle size={16} className="text-red-500" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700',
  processed: 'bg-green-50 text-green-700',
  failed: 'bg-red-50 text-red-700',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?page=${page}&limit=20`);
      const data: LogsResponse = await res.json();
      setLogs(data.logs);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const reprocessLog = async (id: string) => {
    try {
      const res = await fetch(`/api/logs/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Reprocess failed');
      fetchLogs();
    } catch (error) {
      console.error('Failed to reprocess:', error);
    }
  };

  const deleteLog = async (id: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return;

    try {
      await fetch(`/api/logs/${id}`, { method: 'DELETE' });
      fetchLogs();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">Email Logs</h1>
        <Button variant="secondary" onClick={fetchLogs}>
          <RefreshCw size={18} className="mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Mail size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No email logs yet.</p>
            <p className="text-sm text-muted-foreground/70 mt-2">
              Send an email to your notes address to see logs here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {statusIcons[log.status]}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColors[log.status]}`}
                      >
                        {log.status}
                      </span>
                      {log.actionType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {log.actionType}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mb-1">
                      From: <span className="font-medium">{log.fromEmail}</span>
                    </p>
                    {log.subject && (
                      <p className="text-foreground font-medium mb-2">
                        {log.subject}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70">
                      {format(new Date(log.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>

                    {expandedLog === log.id && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="text-sm font-medium text-foreground mb-1">
                            Email Body:
                          </p>
                          <pre className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap">
                            {log.body}
                          </pre>
                        </div>

                        {log.aiResult && (
                          <div>
                            <p className="text-sm font-medium text-foreground mb-1">
                              AI Result:
                            </p>
                            <pre className="text-sm text-muted-foreground bg-muted p-3 rounded-lg overflow-x-auto">
                              {JSON.stringify(log.aiResult, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.errorMessage && (
                          <div>
                            <p className="text-sm font-medium text-destructive mb-1">
                              Error:
                            </p>
                            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                              {log.errorMessage}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedLog(expandedLog === log.id ? null : log.id)
                      }
                    >
                      {expandedLog === log.id ? 'Collapse' : 'Expand'}
                    </Button>
                    {log.status === 'failed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => reprocessLog(log.id)}
                      >
                        <RefreshCw size={16} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteLog(log.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
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
