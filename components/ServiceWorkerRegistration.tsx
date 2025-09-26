'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, RefreshCw, Wifi, WifiOff } from 'lucide-react';

interface ServiceWorkerRegistrationProps {
  children: React.ReactNode;
}

export default function ServiceWorkerRegistration({ children }: ServiceWorkerRegistrationProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Service worker registered successfully:', registration);
          setSwRegistration(registration);

          // Check for updates
          registration.addEventListener('updatefound', () => {
            console.log('[SW] Update found, installing...');
            setIsInstalling(true);
            
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available
                    console.log('[SW] New content available');
                    setUpdateAvailable(true);
                    setIsInstalling(false);
                  } else {
                    // Content is cached for offline use
                    console.log('[SW] Content cached for offline use');
                    setIsInstalling(false);
                  }
                }
              });
            }
          });

          // Check for existing updates
          registration.update();
        })
        .catch((error) => {
          console.error('[SW] Service worker registration failed:', error);
        });
    }

    // Listen for messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[SW] Message from service worker:', event.data);
        
        if (event.data && event.data.type === 'SKIP_WAITING') {
          window.location.reload();
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdate = () => {
    if (swRegistration && swRegistration.waiting) {
      // Tell the service worker to skip waiting
      swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const handleInstall = () => {
    // Trigger the install prompt
    if ('serviceWorker' in navigator && swRegistration) {
      // This would typically trigger a PWA install prompt
      console.log('[SW] Triggering install prompt');
    }
  };

  return (
    <>
      {children}
      
      {/* Offline Indicator */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white p-2 text-center text-sm">
          <div className="flex items-center justify-center space-x-2">
            <WifiOff className="h-4 w-4" />
            <span>You're offline. Some features may be limited.</span>
          </div>
        </div>
      )}

      {/* Update Available Banner */}
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white p-3">
          <Card className="bg-transparent border-none shadow-none text-white">
            <CardContent className="p-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="h-5 w-5" />
                  <div>
                    <p className="font-medium">App Update Available</p>
                    <p className="text-sm text-blue-100">New features and improvements are ready!</p>
                  </div>
                </div>
                <Button
                  onClick={handleUpdate}
                  variant="secondary"
                  size="sm"
                  className="bg-white text-blue-600 hover:bg-blue-50"
                >
                  Update Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Installing Indicator */}
      {isInstalling && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="bg-white shadow-lg border border-gray-200">
            <CardContent className="p-3">
              <div className="flex items-center space-x-3">
                <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-gray-700">Installing update...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Install Prompt */}
      {isOnline && !updateAvailable && (
        <div className="fixed bottom-4 left-4 z-40">
          <Card className="bg-white shadow-lg border border-gray-200 max-w-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center space-x-2">
                <Download className="h-4 w-4 text-purple-600" />
                <span>Install App</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-gray-600 mb-3">
                Install Servio for a better experience with offline access and push notifications.
              </p>
              <Button
                onClick={handleInstall}
                size="sm"
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Install Now
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

// Hook for PWA installation
export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App was installed');
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
    } else {
      console.log('[PWA] User dismissed the install prompt');
    }
    
    setDeferredPrompt(null);
    setIsInstallable(false);
    return outcome === 'accepted';
  };

  return {
    isInstallable,
    install
  };
}
