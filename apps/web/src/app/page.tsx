'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@warehouse/shared';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Redirect based on role
    switch (user?.role) {
      case Role.ADMIN:
        router.replace('/admin');
        break;
      case Role.WAREHOUSE_STAFF:
        router.replace('/warehouse');
        break;
      case Role.USER:
      default:
        router.replace('/dashboard');
        break;
    }
  }, [isAuthenticated, isLoading, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
