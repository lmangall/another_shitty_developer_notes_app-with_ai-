'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface QuickTodoInputProps {
  onSubmit: (title: string) => void;
  isLoading?: boolean;
}

export function QuickTodoInput({ onSubmit, isLoading }: QuickTodoInputProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && !isLoading) {
      onSubmit(title.trim());
      setTitle('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        placeholder="Add a new task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="flex-1"
        disabled={isLoading}
      />
      <Button type="submit" disabled={!title.trim() || isLoading}>
        <Plus size={18} className="mr-1" />
        Add
      </Button>
    </form>
  );
}
