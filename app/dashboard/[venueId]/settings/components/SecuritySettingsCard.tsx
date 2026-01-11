"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Lock, Shield } from "lucide-react";

interface SecuritySettingsCardProps {

}

export function SecuritySettingsCard({
  shouldShowSetPassword,
  showPasswordDialog,
  setShowPasswordDialog,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  loading,
  onChangePassword,
  onCancel,
  twoFactorEnabled,
  setTwoFactorEnabled,
}: SecuritySettingsCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Shield className="h-5 w-5 text-blue-600" />
          Security Settings
        </CardTitle>
        <CardDescription>Manage your account security</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <Accordion type="single" collapsible className="w-full space-y-3">
          <AccordionItem value="password" className="border-none">
            <AccordionTrigger className="hover:no-underline bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-3 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <div className="flex items-center gap-2 text-gray-900">
                <Lock className="h-4 w-4 text-gray-700" />
                <span className="text-gray-900 font-medium">
                  {shouldShowSetPassword ? "Set Password" : "Change Password"}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-gray-600">
                  {shouldShowSetPassword
                    ? "Set a password so you can also sign in with your email and password"
                    : "Update your account password"}
                </p>
                <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full rounded-lg">
                      {shouldShowSetPassword ? "Set Password" : "Change Password"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-xl">
                    <DialogHeader>
                      <DialogTitle>
                        {shouldShowSetPassword ? "Set Password" : "Change Password"}
                      </DialogTitle>
                      <DialogDescription>
                        {shouldShowSetPassword
                          ? "Create a password for your account so you can sign in with email and password in the future."
                          : "Enter your new password below."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="newPassword">
                          {shouldShowSetPassword ? "Password" : "New Password"}
                        </Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={
                            shouldShowSetPassword ? "Create a password" : "Enter new password"
                          }
                          disabled={loading}
                          className="rounded-lg"
                        />
                      </div>

                      <div>
                        <Label htmlFor="confirmPassword">
                          {shouldShowSetPassword ? "Confirm Password" : "Confirm New Password"}
                        </Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={
                            shouldShowSetPassword ? "Confirm your password" : "Confirm new password"
                          }
                          disabled={loading}
                          className="rounded-lg"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={onChangePassword}
                          disabled={loading || !newPassword || !confirmPassword}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          {loading
                            ? shouldShowSetPassword
                              ? "Setting..."

                              : "Update Password"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={onCancel}
                          disabled={loading}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="2fa" className="mt-4 border-none">
            <AccordionTrigger className="hover:no-underline bg-gray-100 hover:bg-gray-200 rounded-lg px-4 py-3 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <div className="flex items-center gap-2 text-gray-900">
                <Shield className="h-4 w-4 text-gray-700" />
                <span className="text-gray-900 font-medium">Two-Factor Authentication</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-4">
                <p className="text-sm text-gray-600">
                  Add an extra layer of security to your account (Coming Soon)
                </p>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">Enable 2FA</p>
                    <p className="text-xs text-gray-600">This feature will be available soon</p>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={setTwoFactorEnabled}
                    disabled
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
