'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Save, X } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { MarkdownEditor } from '@/components/notes/markdown-editor';
import { format } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  useEffect(() => {
    fetchNote();
  }, [id]);

  const fetchNote = async () => {
    try {
      const res = await fetch(`/api/notes/${id}`);
      if (!res.ok) throw new Error('Note not found');
      const data = await res.json();
      setNote(data);
      setTitle(data.title);
      setContent(data.content);
    } catch (error) {
      console.error('Failed to fetch note:', error);
      router.push('/notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error('Failed to update note');
      const updated = await res.json();
      setNote(updated);
      setEditing(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      router.push('/notes');
    } catch (error) {
      console.error('Failed to delete note:', error);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!note) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/notes"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft size={20} className="mr-2" />
        Back to Notes
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          {editing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold"
            />
          ) : (
            <h1 className="text-xl font-bold text-foreground">{note.title}</h1>
          )}

          <div className="flex gap-2">
            {editing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setTitle(note.title);
                    setContent(note.content);
                  }}
                >
                  <X size={18} />
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={18} className="mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 size={18} />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 size={18} />
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {editing ? (
            <MarkdownEditor
              value={content}
              onChange={setContent}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onSave={handleSave}
              autoFocus
            />
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
            </div>
          )}
        </CardContent>

        <CardFooter className="text-sm text-muted-foreground">
          Created {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
          {note.updatedAt !== note.createdAt && (
            <span className="ml-4">
              Updated {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}
            </span>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
