'use client';

import { useState, useEffect } from 'react';
import { Calendar, Check, ExternalLink, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToastActions } from '@/components/ui/toast';

interface Integration {
  id: string;
  provider: string;
  status: string;
  connectedAt: string;
}

const AVAILABLE_INTEGRATIONS = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Create and manage calendar events through natural language',
    icon: Calendar,
    features: ['Create events', 'List events', 'Update events', 'Delete events'],
  },
];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const toast = useToastActions();

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations || []);
      }
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider: string) => {
    setConnecting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}/connect`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          // Open OAuth flow in new window
          window.open(data.redirectUrl, '_blank', 'width=600,height=700');
          toast.info('Please complete the authorization in the popup window.');
          // Poll for connection status
          pollConnectionStatus(provider);
        }
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to initiate connection');
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setConnecting(null);
    }
  };

  const pollConnectionStatus = async (provider: string) => {
    const maxAttempts = 30; // 5 minutes with 10s intervals
    let attempts = 0;

    const poll = async () => {
      attempts++;
      try {
        const res = await fetch('/api/integrations');
        if (res.ok) {
          const data = await res.json();
          const connected = data.integrations?.find(
            (i: Integration) => i.provider === provider && i.status === 'active'
          );
          if (connected) {
            setIntegrations(data.integrations);
            toast.success(`${provider} has been connected successfully.`);
            return;
          }
        }
      } catch (error) {
        console.error('Poll error:', error);
      }

      if (attempts < maxAttempts) {
        setTimeout(poll, 10000);
      }
    };

    poll();
  };

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      const res = await fetch(`/api/integrations/${provider}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setIntegrations(integrations.filter((i) => i.provider !== provider));
        toast.success(`${provider} has been disconnected.`);
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setDisconnecting(null);
    }
  };

  const getIntegrationStatus = (provider: string) => {
    return integrations.find((i) => i.provider === provider);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Integrations</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect external services to enhance your AI assistant capabilities
        </p>
      </div>

      <div className="grid gap-4">
        {AVAILABLE_INTEGRATIONS.map((integration) => {
          const status = getIntegrationStatus(integration.id);
          const isConnected = status?.status === 'active';
          const Icon = integration.icon;

          return (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {integration.name}
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 text-xs font-normal text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" />
                            Connected
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>{integration.description}</CardDescription>
                    </div>
                  </div>
                  <div>
                    {isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={disconnecting === integration.id}
                      >
                        {disconnecting === integration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <X className="h-4 w-4 mr-2" />
                        )}
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleConnect(integration.id)}
                        disabled={connecting === integration.id}
                      >
                        {connecting === integration.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ExternalLink className="h-4 w-4 mr-2" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Features: </span>
                  {integration.features.join(' • ')}
                </div>
                {isConnected && status?.connectedAt && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Connected on {new Date(status.connectedAt).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Once connected, you can use natural language to interact with your services through the
            Quick Input or chat interface.
          </p>
          <p>
            <strong>Examples:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>&quot;Schedule a meeting with John tomorrow at 2pm&quot;</li>
            <li>&quot;What&apos;s on my calendar this week?&quot;</li>
            <li>&quot;Cancel my 3pm appointment&quot;</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
