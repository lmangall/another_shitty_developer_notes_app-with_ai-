'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, Save, X } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key - handle list continuation
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const { selectionStart } = textarea;
      const text = content;

      // Find the start of the current line
      const lineStart = text.lastIndexOf('\n', selectionStart - 1) + 1;
      const lineEnd = text.indexOf('\n', selectionStart);
      const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

      // Check for list patterns
      const bulletMatch = currentLine.match(/^(\s*)([-*])\s/);
      const checkboxMatch = currentLine.match(/^(\s*)([-*])\s\[([ xX])\]\s/);
      const numberedMatch = currentLine.match(/^(\s*)(\d+)\.\s/);

      let listPrefix = '';
      let isEmptyListItem = false;

      if (checkboxMatch) {
        const [fullMatch, indent, marker] = checkboxMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${marker} [ ] `;
      } else if (bulletMatch) {
        const [fullMatch, indent, marker] = bulletMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${marker} `;
      } else if (numberedMatch) {
        const [fullMatch, indent, num] = numberedMatch;
        const lineContent = currentLine.substring(fullMatch.length);
        isEmptyListItem = lineContent.trim() === '';
        listPrefix = `${indent}${parseInt(num) + 1}. `;
      }

      if (listPrefix) {
        e.preventDefault();

        if (isEmptyListItem) {
          const beforeLine = text.substring(0, lineStart);
          const afterLine = text.substring(lineEnd === -1 ? text.length : lineEnd);
          const newText = beforeLine.trimEnd() + afterLine;
          setContent(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = beforeLine.trimEnd().length;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        } else {
          const before = text.substring(0, selectionStart);
          const after = text.substring(selectionStart);
          const newText = before + '\n' + listPrefix + after;
          setContent(newText);
          setTimeout(() => {
            textarea.focus();
            const newPos = selectionStart + 1 + listPrefix.length;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      }
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
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={15}
              placeholder="Write your note... (Markdown supported)"
            />
          ) : (
            <div className="prose prose-sm max-w-none">
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
