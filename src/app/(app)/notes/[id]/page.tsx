'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Save, X, Edit2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { TiptapEditor } from '@/components/notes/tiptap-editor';
import { format } from 'date-fns';
import { getNote, updateNote, deleteNote } from '@/actions/notes';
import type { Note } from '@/db/schema';

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Extract body content by removing the first line if it matches the title
function getBodyContent(content: string, title: string): string {
  const lines = content.split('\n');
  // Check if first line looks like the title
  const firstLine = lines[0]?.trim() || '';
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedFirstLine = firstLine.toLowerCase();

  // If first line matches or is similar to the title, skip it
  if (normalizedFirstLine === normalizedTitle ||
      normalizedTitle.startsWith(normalizedFirstLine) ||
      normalizedFirstLine.startsWith(normalizedTitle)) {
    let startIndex = 1;
    // Skip empty lines after the title
    while (startIndex < lines.length && lines[startIndex].trim() === '') {
      startIndex++;
    }
    return lines.slice(startIndex).join('\n');
  }
  return content;
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

  useEffect(() => {
    fetchNoteData();
  }, [id]);

  const fetchNoteData = async () => {
    try {
      const result = await getNote(id);
      if (!result.success) {
        router.push('/notes');
        return;
      }
      setNote(result.data);
      setTitle(result.data.title);
      // Filter out the title from content if it appears as the first line
      setContent(getBodyContent(result.data.content, result.data.title));
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
      const result = await updateNote({ id, title, content });

      if (!result.success) {
        console.error('Failed to save note:', result.error);
        return;
      }
      setNote(result.data);
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
      const result = await deleteNote(id);
      if (!result.success) {
        console.error('Failed to delete note:', result.error);
        setDeleting(false);
        return;
      }
      router.push('/notes');
    } catch (error) {
      console.error('Failed to delete note:', error);
      setDeleting(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    if (note) {
      setTitle(note.title);
      setContent(note.content);
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
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  <X size={18} />
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save size={18} className="mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
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
          <TiptapEditor
            value={content}
            onChange={setContent}
            onSave={handleSave}
            editable={editing}
            showToolbar={editing}
            autoFocus={editing}
            onClickToEdit={() => setEditing(true)}
          />
        </CardContent>

        <CardFooter className="text-sm text-muted-foreground flex justify-between">
          <span>{countWords(content)} words</span>
          <div>
            Created {format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}
            {note.updatedAt !== note.createdAt && (
              <span className="ml-4">
                Updated {format(new Date(note.updatedAt), 'MMM d, yyyy h:mm a')}
              </span>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
