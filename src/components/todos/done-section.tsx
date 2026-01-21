'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { TodoItem } from '@/app/(app)/todos/actions';

interface DoneSectionProps {
  todos: TodoItem[];
  onComplete: (id: string) => void;
  onUncomplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: { title?: string; description?: string }) => void;
}

export function DoneSection({
  todos,
  onUncomplete,
  onDelete,
}: DoneSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (todos.length === 0) return null;

  return (
    <div className="rounded-lg border p-4 bg-card/50">
      <Button
        variant="ghost"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full justify-start p-0 h-auto hover:bg-transparent"
      >
        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <CheckCircle2 size={18} className="mx-2 text-green-500" />
        <span className="font-semibold">Done</span>
      </Button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 group"
            >
              <Checkbox
                checked={true}
                onCheckedChange={() => onUncomplete(todo.id)}
                className="h-5 w-5"
              />
              <span className="flex-1 line-through text-muted-foreground">
                {todo.title}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(todo.id)}
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
