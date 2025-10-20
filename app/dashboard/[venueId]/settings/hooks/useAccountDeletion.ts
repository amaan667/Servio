import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { User } from './useVenueSettings';

export function useAccountDeletion(user: User) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setError('Please type DELETE to confirm account deletion');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: venueError } = await createClient()
        .from('venues')
        .delete()
        .eq('owner_user_id', user.id);

      if (venueError) {
        console.error('Error deleting venues:', venueError);
      }

      const { error } = await createClient().auth.admin.deleteUser(user.id);

      if (error) {
        throw new Error(error.message);
      }

      try {
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } catch (error) {
        console.error('Sign out error:', error);
      }
      
      try {
        const { clearAuthStorage } = await import('@/lib/supabase');
        clearAuthStorage();
      } catch (error) {
        console.error('Clear storage error:', error);
      }
      
      router.push('/');
      
      toast({
        title: "Account Deleted",
        description: "Your account has been permanently deleted.",
      });
    } catch (err: unknown) {
      setError(err.message || 'Failed to delete account');
      toast({
        title: "Error",
        description: err.message || 'Failed to delete account',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    showDeleteDialog,
    setShowDeleteDialog,
    deleteConfirmation,
    setDeleteConfirmation,
    deleteAccount
  };
}

