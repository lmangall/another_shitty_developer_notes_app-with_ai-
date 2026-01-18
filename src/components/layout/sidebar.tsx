'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FileText, Bell, Mail, Mic, LogOut, Send } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/logs', label: 'Email Logs', icon: Mail },
  { href: '/input', label: 'Quick Input', icon: Mic },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  const handleCreateNote = async () => {
    if (!newNote.trim() || creating) return;

    setCreating(true);
    try {
      const lines = newNote.trim().split('\n');
      const title = lines[0].slice(0, 100) || 'Untitled';
      const content = newNote.trim();

      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (res.ok) {
        setNewNote('');
        router.push('/notes');
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCreateNote();
    }
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground min-h-screen flex flex-col border-r border-sidebar-border">
      <div className="p-6">
        <h1 className="text-xl font-bold">Notes App</h1>
      </div>

      {/* Quick Note Input */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Textarea
            placeholder="New note... (Cmd+Enter)"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[80px] pr-10 text-sm resize-none bg-sidebar-accent/50 border-sidebar-border"
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute bottom-2 right-2 h-7 w-7"
            onClick={handleCreateNote}
            disabled={!newNote.trim() || creating}
          >
            <Send size={14} />
          </Button>
        </div>
      </div>

      <nav className="flex-1 px-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-sm',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut size={18} />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
