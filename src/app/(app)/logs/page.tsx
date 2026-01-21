'use client';

import { useState, useEffect, useTransition } from 'react';
import { Mail, RefreshCw, Trash2, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { getLogs, reprocessLog, deleteLog } from '@/actions/logs';
import type { EmailLog } from '@/db/schema';

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock size={14} className="text-yellow-500" />,
  processed: <CheckCircle size={14} className="text-green-500" />,
  failed: <XCircle size={14} className="text-red-500" />,
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  processed: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchLogs = async () => {
    setLoading(true);
    const result = await getLogs({ page, limit: 20 });
    if (result.success) {
      setLogs(result.data.items);
      setTotalPages(result.data.totalPages);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleReprocessLog = (id: string) => {
    startTransition(async () => {
      const result = await reprocessLog(id);
      if (result.success) {
        fetchLogs();
      }
    });
  };

  const handleDeleteLog = (id: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return;

    startTransition(async () => {
      const result = await deleteLog(id);
      if (result.success) {
        fetchLogs();
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-foreground">Email Logs</h1>
        <Button variant="secondary" onClick={fetchLogs} disabled={loading || isPending}>
          <RefreshCw size={18} className={`mr-2 ${(loading || isPending) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        View incoming emails sent to your notes address. Each email is processed by AI to create notes or reminders.
      </p>

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
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left px-4 py-3 w-10"></th>
                  <th className="text-left px-4 py-3 w-28">
                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                  </th>
                  <th className="text-left px-4 py-3 w-28">
                    <span className="text-xs font-medium text-muted-foreground">Action</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-medium text-muted-foreground">From</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground">Subject</span>
                  </th>
                  <th className="text-right px-4 py-3 w-36">
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                  </th>
                  <th className="text-right px-4 py-3 w-20">
                    <span className="text-xs font-medium text-muted-foreground">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      {/* Expand toggle */}
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          {expandedLog === log.id ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </Button>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {statusIcons[log.status]}
                          <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${statusColors[log.status]}`}>
                            {log.status}
                          </span>
                        </div>
                      </td>

                      {/* Action Type */}
                      <td className="px-4 py-3">
                        {log.actionType ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {log.actionType}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* From */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground truncate max-w-[200px] block">
                          {log.fromEmail}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground line-clamp-1">
                          {log.subject || '(no subject)'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <MoreVertical size={14} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                            >
                              {expandedLog === log.id ? (
                                <>
                                  <ChevronUp size={14} className="mr-2" />
                                  Collapse
                                </>
                              ) : (
                                <>
                                  <ChevronDown size={14} className="mr-2" />
                                  Expand
                                </>
                              )}
                            </DropdownMenuItem>
                            {log.status === 'failed' && (
                              <DropdownMenuItem
                                onClick={() => handleReprocessLog(log.id)}
                                disabled={isPending}
                              >
                                <RefreshCw size={14} className={`mr-2 ${isPending ? 'animate-spin' : ''}`} />
                                Reprocess
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteLog(log.id)}
                              className="text-destructive focus:text-destructive"
                              disabled={isPending}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {expandedLog === log.id && (
                      <tr key={`${log.id}-expanded`} className="border-b bg-muted/20">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-4 pl-10">
                            <div>
                              <p className="text-sm font-medium text-foreground mb-1">
                                Email Body:
                              </p>
                              <pre className="text-sm text-muted-foreground bg-muted p-3 rounded-lg whitespace-pre-wrap">
                                {log.body}
                              </pre>
                            </div>

                            {log.aiResult !== null && (
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
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
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
