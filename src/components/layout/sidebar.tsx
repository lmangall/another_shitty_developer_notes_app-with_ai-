'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Bell, Mail, Mic, LogOut } from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/notes', label: 'Notes', icon: FileText },
  { href: '/reminders', label: 'Reminders', icon: Bell },
  { href: '/logs', label: 'Email Logs', icon: Mail },
  { href: '/input', label: 'Quick Input', icon: Mic },
];

export function Sidebar() {
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground min-h-screen flex flex-col border-r border-sidebar-border">
      <div className="p-6">
        <h1 className="text-xl font-bold">Notes App</h1>
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
