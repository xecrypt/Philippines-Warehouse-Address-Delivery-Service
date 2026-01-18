'use client';

import { Bell, User } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui';
import { NotificationsDropdown } from './notifications-dropdown';

export function Header() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
      <div>
        <h1 className="text-lg font-semibold">
          Welcome back, {user.firstName}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <NotificationsDropdown />

        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium">{user.firstName}</span>
        </div>
      </div>
    </header>
  );
}
