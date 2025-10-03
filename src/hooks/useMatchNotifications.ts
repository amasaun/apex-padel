import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatTime } from '@/lib/utils';

export function useMatchNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Check current notification permission
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications');
      alert('Your browser does not support notifications');
      return false;
    }

    console.log('Requesting notification permission...');
    try {
      const result = await Notification.requestPermission();
      console.log('Permission result:', result);
      setPermission(result);

      if (result === 'denied') {
        alert('Notifications were blocked. Please enable them in your browser settings:\n\nChrome: chrome://settings/content/notifications\nSafari: Preferences > Websites > Notifications');
      }

      return result === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      alert('Error requesting notification permission. Check console for details.');
      return false;
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const showNotification = (match: any) => {
    if (permission !== 'granted') return;

    const title = '🎾 New Padel Match Available!';
    const body = `${match.title || 'Match'} at ${match.location}\n${formatDate(match.date)} at ${formatTime(match.time)}`;

    const notification = new Notification(title, {
      body,
      icon: '/apex-logo.svg',
      badge: '/apex-logo.svg',
      tag: match.id, // Prevents duplicate notifications
      requireInteraction: false, // Auto-close after a few seconds
      data: {
        url: `/matches/${match.id}`,
      },
    });

    // Navigate to match when notification is clicked
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      window.location.href = `/matches/${match.id}`;
      notification.close();
    };
  };

  useEffect(() => {
    if (permission !== 'granted') {
      console.log('Notifications not granted, permission:', permission);
      return;
    }

    console.log('Setting up Supabase realtime subscription for notifications...');

    // Subscribe to new public matches
    const channel = supabase
      .channel('public-matches')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: 'is_private=eq.false',
        },
        (payload) => {
          console.log('🎾 New public match created!', payload.new);
          showNotification(payload.new);
        }
      )
      .subscribe((status) => {
        console.log('Supabase subscription status:', status);
      });

    return () => {
      console.log('Cleaning up Supabase subscription');
      supabase.removeChannel(channel);
    };
  }, [permission]);

  return {
    permission,
    requestPermission,
    isSupported: 'Notification' in window,
  };
}
