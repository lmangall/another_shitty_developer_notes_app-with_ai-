'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToastActions } from '@/components/ui/toast';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function PushNotificationSettings() {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const toast = useToastActions();

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  async function checkNotificationStatus() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PermissionState);

    // Fetch VAPID public key
    try {
      const res = await fetch('/api/push/subscribe');
      if (res.ok) {
        const data = await res.json();
        setVapidKey(data.publicKey);
      }
    } catch {
      console.error('Failed to fetch VAPID key');
    }

    // Check if already subscribed
    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }
  }

  async function checkAndSuggestMultiDevice() {
    try {
      const res = await fetch('/api/push/count');
      if (res.ok) {
        const data = await res.json();
        if (data.count === 1) {
          // User only has one device, suggest iPhone setup
          setTimeout(() => {
            toast.info('Want notifications on your iPhone too?', {
              label: 'Learn how to set up',
              href: '/help/push-setup',
            });
          }, 1500); // Small delay so it doesn't overlap with success message
        }
      }
    } catch {
      // Silently fail - this is just a suggestion
    }
  }

  async function requestPermission() {
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result === 'granted') {
        await subscribeToNotifications();
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function subscribeToNotifications() {
    if (!vapidKey) {
      setTestStatus('Push notifications not configured on server');
      return;
    }

    try {
      // Register service worker if not already
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (res.ok) {
        setIsSubscribed(true);
        setTestStatus('Successfully subscribed to notifications!');

        // Check if user only has one device and suggest iPhone setup
        checkAndSuggestMultiDevice();
      } else {
        throw new Error('Failed to save subscription');
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      setTestStatus('Failed to subscribe. Please try again.');
    }
  }

  async function unsubscribe() {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        setIsSubscribed(false);
        setTestStatus('Unsubscribed from notifications');
      }
    } catch (error) {
      console.error('Error unsubscribing:', error);
      setTestStatus('Failed to unsubscribe');
    } finally {
      setIsLoading(false);
    }
  }

  async function sendTestNotification() {
    setIsLoading(true);
    setTestStatus(null);
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setTestStatus(data.message || 'Test notification sent!');
      } else {
        setTestStatus(data.error || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Error sending test:', error);
      setTestStatus('Failed to send test notification');
    } finally {
      setIsLoading(false);
    }
  }

  if (permission === 'unsupported') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff size={20} />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell size={20} />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about your reminders on your desktop.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {permission === 'denied' ? (
            <p className="text-sm text-muted-foreground">
              Notifications are blocked. Please enable them in your browser settings.
            </p>
          ) : permission === 'granted' && isSubscribed ? (
            <>
              <Button onClick={unsubscribe} variant="outline" disabled={isLoading}>
                {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <BellOff size={16} className="mr-2" />}
                Disable Notifications
              </Button>
              <Button onClick={sendTestNotification} disabled={isLoading}>
                {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                Send Test
              </Button>
            </>
          ) : (
            <Button onClick={requestPermission} disabled={isLoading}>
              {isLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Bell size={16} className="mr-2" />}
              Enable Notifications
            </Button>
          )}
        </div>

        {testStatus && (
          <p className={`text-sm ${testStatus.includes('Failed') || testStatus.includes('not configured') ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
            {testStatus}
          </p>
        )}

        {!vapidKey && permission !== 'denied' && (
          <p className="text-sm text-muted-foreground">
            Push notifications require VAPID keys to be configured in environment variables.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
