'use client';

import { useRef, useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, CheckCircle2 } from 'lucide-react';
import type { TodoItem } from '@/app/(app)/todos/actions';

interface EisenhowerMatrixProps {
  todos: TodoItem[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
}

interface DraggingState {
  id: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

export function EisenhowerMatrix({
  todos,
  onComplete,
  onDelete,
  onPositionChange,
}: EisenhowerMatrixProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const doneZoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [tempPosition, setTempPosition] = useState<{ x: number; y: number } | null>(null);
  const [isOverDoneZone, setIsOverDoneZone] = useState(false);

  const getPositionFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 50, y: 50 };
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      return {
        x: Math.max(2, Math.min(98, x)),
        y: Math.max(2, Math.min(98, y)),
      };
    },
    []
  );

  const isOverDone = useCallback((clientX: number, clientY: number) => {
    if (!doneZoneRef.current) return false;
    const rect = doneZoneRef.current.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, todo: TodoItem) => {
      e.preventDefault();
      const pos = getPositionFromEvent(e.clientX, e.clientY);
      setDragging({
        id: todo.id,
        startX: todo.positionX,
        startY: todo.positionY,
        offsetX: pos.x - todo.positionX,
        offsetY: pos.y - todo.positionY,
      });
    },
    [getPositionFromEvent]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const pos = getPositionFromEvent(e.clientX, e.clientY);
      setTempPosition({
        x: pos.x - dragging.offsetX,
        y: pos.y - dragging.offsetY,
      });
      setIsOverDoneZone(isOverDone(e.clientX, e.clientY));
    },
    [dragging, getPositionFromEvent, isOverDone]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        if (isOverDone(e.clientX, e.clientY)) {
          onComplete(dragging.id);
        } else if (tempPosition) {
          onPositionChange(dragging.id, tempPosition.x, tempPosition.y);
        }
      }
      setDragging(null);
      setTempPosition(null);
      setIsOverDoneZone(false);
    },
    [dragging, tempPosition, onPositionChange, onComplete, isOverDone]
  );

  const handleMouseLeave = useCallback(() => {
    if (dragging && tempPosition) {
      onPositionChange(dragging.id, tempPosition.x, tempPosition.y);
    }
    setDragging(null);
    setTempPosition(null);
    setIsOverDoneZone(false);
  }, [dragging, tempPosition, onPositionChange]);

  return (
    <div className="relative select-none">
      {/* Axis Labels */}
      <div className="absolute -left-6 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap z-10">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
          Important
        </span>
      </div>
      <div className="text-center mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
          Urgent
        </span>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative ml-6 border-2 border-border rounded-lg overflow-hidden"
        style={{ height: '500px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Quadrant backgrounds - brighter colors */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none">
          <div className="bg-red-500/20 border-r-2 border-b-2 border-border" />
          <div className="bg-blue-500/20 border-b-2 border-border" />
          <div className="bg-amber-500/20 border-r-2 border-border" />
          <div className="bg-zinc-400/20" />
        </div>

        {/* Quadrant labels */}
        <div className="absolute top-3 left-3 text-sm font-bold text-red-600 dark:text-red-400 pointer-events-none">
          Do First
        </div>
        <div className="absolute top-3 right-3 text-sm font-bold text-blue-600 dark:text-blue-400 pointer-events-none">
          Schedule
        </div>
        <div className="absolute bottom-3 left-3 text-sm font-bold text-amber-600 dark:text-amber-400 pointer-events-none">
          Delegate
        </div>
        <div className="absolute bottom-3 right-3 text-sm font-bold text-zinc-500 dark:text-zinc-400 pointer-events-none">
          Eliminate
        </div>

        {/* Done drop zone - appears when dragging */}
        <div
          ref={doneZoneRef}
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full border-2 border-dashed transition-all flex items-center gap-2 ${
            dragging
              ? isOverDoneZone
                ? 'bg-green-500/30 border-green-500 scale-110'
                : 'bg-green-500/10 border-green-500/50 opacity-100'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <CheckCircle2 size={20} className={isOverDoneZone ? 'text-green-600' : 'text-green-500/70'} />
          <span className={`text-sm font-semibold ${isOverDoneZone ? 'text-green-600' : 'text-green-500/70'}`}>
            Drop to complete
          </span>
        </div>

        {/* Todo cards */}
        {todos.map((todo) => {
          const isDraggingThis = dragging?.id === todo.id;
          const x = isDraggingThis && tempPosition ? tempPosition.x : todo.positionX;
          const y = isDraggingThis && tempPosition ? tempPosition.y : todo.positionY;

          // Determine quadrant color based on position
          const isUrgent = x < 50;
          const isImportant = y < 50;
          let cardBorderColor = 'border-zinc-300 dark:border-zinc-600';
          if (isUrgent && isImportant) cardBorderColor = 'border-red-300 dark:border-red-700';
          else if (!isUrgent && isImportant) cardBorderColor = 'border-blue-300 dark:border-blue-700';
          else if (isUrgent && !isImportant) cardBorderColor = 'border-amber-300 dark:border-amber-700';

          return (
            <div
              key={todo.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-shadow group ${
                isDraggingThis ? 'z-50 shadow-xl scale-105' : 'z-10 hover:z-20'
              } ${isDraggingThis && isOverDoneZone ? 'opacity-50' : ''}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, todo)}
            >
              <div
                className={`bg-card border-2 ${cardBorderColor} rounded-lg p-2.5 shadow-md hover:shadow-lg transition-all min-w-[130px] max-w-[200px] ${
                  isDraggingThis ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => onComplete(todo.id)}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <span className="text-sm font-medium flex-1 line-clamp-2">
                    {todo.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(todo.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Axis labels at bottom */}
      <div className="flex justify-between mt-2 ml-6 px-2">
        <span className="text-[10px] text-muted-foreground">← More Urgent</span>
        <span className="text-[10px] text-muted-foreground">Less Urgent →</span>
      </div>
    </div>
  );
}
