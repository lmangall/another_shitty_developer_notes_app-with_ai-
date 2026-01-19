'use client';

import Link from 'next/link';
import { Trash2, ArrowUp, ArrowDown, ArrowUpDown, Pin } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { TagBadge } from '@/components/tag-badge';
import { TagPicker } from '@/components/tag-picker';
import type { NoteSortOption, SortOrder } from '@/lib/constants';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  cardColSpan: number;
  cardRowSpan: number;
  isPinned: boolean;
}

interface NotesTableProps {
  notes: Note[];
  sortBy: NoteSortOption;
  sortOrder: SortOrder;
  onSortChange: (column: NoteSortOption) => void;
  onDelete: (note: Note) => void;
  onTagsChange: () => void;
  onPinToggle: (noteId: string, isPinned: boolean) => void;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function NotesTable({
  notes,
  sortBy,
  sortOrder,
  onSortChange,
  onDelete,
  onTagsChange,
  onPinToggle,
}: NotesTableProps) {
  function SortHeader({
    column,
    label,
    className,
  }: {
    column: NoteSortOption;
    label: string;
    className?: string;
  }) {
    const isActive = sortBy === column;

    return (
      <button
        onClick={() => onSortChange(column)}
        className={`flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ${className || ''}`}
      >
        {label}
        {isActive ? (
          sortOrder === 'asc' ? (
            <ArrowUp size={12} />
          ) : (
            <ArrowDown size={12} />
          )
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3">
                <SortHeader column="title" label="Title" />
              </th>
              <th className="text-left px-4 py-3 hidden md:table-cell">
                <span className="text-xs font-medium text-muted-foreground">
                  Preview
                </span>
              </th>
              <th className="text-left px-4 py-3 hidden lg:table-cell">
                <span className="text-xs font-medium text-muted-foreground">
                  Tags
                </span>
              </th>
              <th className="text-right px-4 py-3 hidden sm:table-cell w-20">
                <span className="text-xs font-medium text-muted-foreground">
                  Words
                </span>
              </th>
              <th className="text-right px-4 py-3 hidden xl:table-cell w-28">
                <SortHeader column="createdAt" label="Created" />
              </th>
              <th className="text-right px-4 py-3 w-28">
                <SortHeader column="updatedAt" label="Updated" className="justify-end" />
              </th>
              <th className="text-right px-4 py-3 w-20">
                <span className="text-xs font-medium text-muted-foreground">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note) => (
              <tr
                key={note.id}
                className="border-b last:border-b-0 hover:bg-muted/30 transition-colors group"
              >
                {/* Title */}
                <td className="px-4 py-3">
                  <Link
                    href={`/notes/${note.id}`}
                    className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1 flex items-center gap-1.5"
                  >
                    {note.isPinned && <Pin size={12} className="text-primary flex-shrink-0" />}
                    {note.title}
                  </Link>
                </td>

                {/* Preview */}
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-sm text-muted-foreground line-clamp-1">
                    {truncateText(note.content.replace(/[#*`\n]/g, ' '), 80)}
                  </span>
                </td>

                {/* Tags */}
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map(tag => (
                      <TagBadge
                        key={tag.id}
                        name={tag.name}
                        color={tag.color}
                        className="text-[10px] px-1.5 py-0"
                      />
                    ))}
                    {note.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{note.tags.length - 3}
                      </span>
                    )}
                  </div>
                </td>

                {/* Words */}
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {countWords(note.content)}
                  </span>
                </td>

                {/* Created */}
                <td className="px-4 py-3 text-right hidden xl:table-cell">
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(note.createdAt), 'MMM d, yyyy')}
                  </span>
                </td>

                {/* Updated */}
                <td className="px-4 py-3 text-right">
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(note.updatedAt), 'MMM d, yyyy')}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        onPinToggle(note.id, !note.isPinned);
                      }}
                      className={`h-7 w-7 p-0 ${note.isPinned ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                      title={note.isPinned ? 'Unpin note' : 'Pin note'}
                    >
                      <Pin size={14} />
                    </Button>
                    <TagPicker
                      noteId={note.id}
                      currentTags={note.tags || []}
                      onTagsChange={onTagsChange}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete(note);
                      }}
                      className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notes.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No notes match your filters
        </div>
      )}
    </div>
  );
}
