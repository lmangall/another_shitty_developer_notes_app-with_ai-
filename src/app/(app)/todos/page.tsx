'use client';

import { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import {
  getTodos,
  createTodo,
  deleteTodo,
  completeTodo,
  uncompleteTodo,
  updateTodoPosition,
  type TodoItem,
} from './actions';
import { QuickTodoInput } from '@/components/todos/quick-todo-input';
import { EisenhowerMatrix } from '@/components/todos/eisenhower-matrix';
import { DoneSection } from '@/components/todos/done-section';
import { useToastActions } from '@/components/ui/toast';

export default function TodosPage() {
  const [todos, setTodos] = useState<{ pending: TodoItem[]; completed: TodoItem[] }>({
    pending: [],
    completed: [],
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const toast = useToastActions();

  async function fetchTodos() {
    setLoading(true);
    try {
      const data = await getTodos();
      setTodos(data);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodos();
  }, []);

  async function handleCreate(title: string) {
    setCreating(true);
    try {
      await createTodo({ title });
      await fetchTodos();
      toast.success('Task created');
    } catch (error) {
      console.error('Failed to create todo:', error);
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  async function handleComplete(id: string) {
    // Optimistic update - move from pending to completed
    const todoToComplete = todos.pending.find((t) => t.id === id);
    if (todoToComplete) {
      setTodos((prev) => ({
        pending: prev.pending.filter((t) => t.id !== id),
        completed: [
          { ...todoToComplete, status: 'completed', completedAt: new Date() },
          ...prev.completed,
        ],
      }));
    }

    try {
      await completeTodo(id);
    } catch (error) {
      console.error('Failed to complete todo:', error);
      toast.error('Failed to complete task');
      await fetchTodos();
    }
  }

  async function handleUncomplete(id: string) {
    // Optimistic update - move from completed to pending
    const todoToRestore = todos.completed.find((t) => t.id === id);
    if (todoToRestore) {
      setTodos((prev) => ({
        pending: [
          { ...todoToRestore, status: 'pending', completedAt: null },
          ...prev.pending,
        ],
        completed: prev.completed.filter((t) => t.id !== id),
      }));
    }

    try {
      await uncompleteTodo(id);
    } catch (error) {
      console.error('Failed to uncomplete todo:', error);
      toast.error('Failed to restore task');
      await fetchTodos();
    }
  }

  async function handleDelete(id: string) {
    // Optimistic update - remove from whichever list it's in
    setTodos((prev) => ({
      pending: prev.pending.filter((t) => t.id !== id),
      completed: prev.completed.filter((t) => t.id !== id),
    }));

    try {
      await deleteTodo(id);
      toast.success('Task deleted');
    } catch (error) {
      console.error('Failed to delete todo:', error);
      toast.error('Failed to delete task');
      await fetchTodos();
    }
  }

  async function handlePositionChange(id: string, x: number, y: number) {
    // Optimistic update
    setTodos((prev) => ({
      ...prev,
      pending: prev.pending.map((t) =>
        t.id === id ? { ...t, positionX: Math.round(x), positionY: Math.round(y) } : t
      ),
    }));

    try {
      await updateTodoPosition(id, x, y);
    } catch (error) {
      console.error('Failed to update position:', error);
      await fetchTodos();
    }
  }

  return (
    <div className="w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CheckSquare className="text-primary" />
          Todos
        </h1>
      </div>

      {/* Quick Create */}
      <div className="mb-6">
        <QuickTodoInput onSubmit={handleCreate} isLoading={creating} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Eisenhower Matrix Canvas */}
          <EisenhowerMatrix
            todos={todos.pending}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onPositionChange={handlePositionChange}
          />

          {/* Done Section */}
          <DoneSection
            todos={todos.completed}
            onComplete={handleComplete}
            onUncomplete={handleUncomplete}
            onDelete={handleDelete}
            onUpdate={() => {}}
          />
        </div>
      )}
    </div>
  );
}
