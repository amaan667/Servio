/**
 * SSO Integration Component
 * Provides Single Sign-On integration with SAML and OAuth providers
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Key, Users, Settings } from "lucide-react";

interface SSOProvider {
  id: string;
  name: string;
  type: "saml" | "oauth" | "oidc";
  enabled: boolean;
  config: unknown;
}

export const SSOIntegration: React.FC = () => {
  const [providers, setProviders] = useState<SSOProvider[]>([
    {
      id: "google",
      name: "Google Workspace",
      type: "oauth",
      enabled: false,
      config: {
        /* Empty */
      },
    },
    {
      id: "microsoft",
      name: "Microsoft Azure AD",
      type: "oidc",
      enabled: false,
      config: {
        /* Empty */
      },
    },
    {
      id: "okta",
      name: "Okta",
      type: "saml",
      enabled: false,
      config: {
        /* Empty */
      },
    },
    {
      id: "auth0",
      name: "Auth0",
      type: "oidc",
      enabled: false,
      config: {
        /* Empty */
      },
    },
  ]);

  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const handleProviderToggle = (providerId: string, enabled: boolean) => {
    setProviders((prev) => prev.map((p) => (p.id === providerId ? { ...p, enabled } : p)));
  };

  const handleConfigUpdate = (providerId: string, config: unknown) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === providerId) {
          const currentConfig = (p.config as Record<string, unknown>) || {};
          const newConfig = (config as Record<string, unknown>) || {};
          return { ...p, config: { ...currentConfig, ...newConfig } };
        }
        return p;
      })
    );
  };

  const getProviderIcon = (type: string) => {
    switch (type) {
      case "saml":
        return <Shield className="h-4 w-4" />;
      case "oauth":
        return <Key className="h-4 w-4" />;
      case "oidc":
        return <Users className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getProviderBadge = (type: string) => {
    const colors = {
      saml: "bg-blue-100 text-blue-800",
      oauth: "bg-green-100 text-green-800",
      oidc: "bg-purple-100 text-purple-800",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SSO Integration</h2>
          <p className="text-gray-600">Configure Single Sign-On providers for your organization</p>
        </div>
        <Button onClick={() => setActiveProvider(null)}>Add New Provider</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getProviderIcon(provider.type)}
                  <CardTitle className="text-lg">{provider.name}</CardTitle>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(enabled) => handleProviderToggle(provider.id, enabled)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={getProviderBadge(provider.type)}>
                  {provider.type.toUpperCase()}
                </Badge>
                {provider.enabled && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {provider.type === "saml" && "SAML 2.0 authentication provider"}
                  {provider.type === "oauth" && "OAuth 2.0 authentication provider"}
                  {provider.type === "oidc" && "OpenID Connect authentication provider"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveProvider(provider.id)}
                  className="w-full"
                >
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Configuration Modal */}
      {activeProvider && (
        <Card>
          <CardHeader>
            <CardTitle>Configure {providers.find((p) => p.id === activeProvider)?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger value="mapping">User Mapping</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      placeholder="Enter client ID"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            clientId?: string;
                          }
                        )?.clientId || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { clientId: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Enter client secret"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            clientSecret?: string;
                          }
                        )?.clientSecret || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { clientSecret: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="redirectUri">Redirect URI</Label>
                    <Input
                      id="redirectUri"
                      placeholder="https://yourdomain.com/auth/callback"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            redirectUri?: string;
                          }
                        )?.redirectUri || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { redirectUri: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Input
                      id="scope"
                      placeholder="openid profile email"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            scope?: string;
                          }
                        )?.scope || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { scope: e.target.value })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="issuer">Issuer URL</Label>
                    <Input
                      id="issuer"
                      placeholder="https://your-provider.com"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            issuer?: string;
                          }
                        )?.issuer || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { issuer: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authorizationUrl">Authorization URL</Label>
                    <Input
                      id="authorizationUrl"
                      placeholder="https://your-provider.com/oauth/authorize"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            authorizationUrl?: string;
                          }
                        )?.authorizationUrl || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { authorizationUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenUrl">Token URL</Label>
                    <Input
                      id="tokenUrl"
                      placeholder="https://your-provider.com/oauth/token"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            tokenUrl?: string;
                          }
                        )?.tokenUrl || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { tokenUrl: e.target.value })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailField">Email Field</Label>
                    <Input
                      id="emailField"
                      placeholder="email"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            emailField?: string;
                          }
                        )?.emailField || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { emailField: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nameField">Name Field</Label>
                    <Input
                      id="nameField"
                      placeholder="name"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            nameField?: string;
                          }
                        )?.nameField || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { nameField: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roleField">Role Field</Label>
                    <Input
                      id="roleField"
                      placeholder="role"
                      value={
                        (
                          providers.find((p) => p.id === activeProvider)?.config as {
                            roleField?: string;
                          }
                        )?.roleField || ""
                      }
                      onChange={(e) =>
                        handleConfigUpdate(activeProvider, { roleField: e.target.value })
                      }
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setActiveProvider(null)}>
                Cancel
              </Button>
              <Button onClick={() => setActiveProvider(null)}>Save Configuration</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
