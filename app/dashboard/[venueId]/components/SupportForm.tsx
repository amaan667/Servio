"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lightbulb, Bug, Loader2, Send, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SupportFormProps {

}

export function SupportForm({ open, onOpenChange, type }: SupportFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({

  const isFeatureRequest = type === "feature";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/support/submit", {

        headers: { "Content-Type": "application/json" },

        }),

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit");
      }

      toast({

      setFormData({ subject: "", description: "", steps: "" });
      onOpenChange(false);
    } catch (error) {
      toast({

    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isFeatureRequest ? "bg-yellow-100" : "bg-red-100"
              }`}
            >
              {isFeatureRequest ? (
                <Lightbulb className="h-5 w-5 text-yellow-600" />
              ) : (
                <Bug className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <DialogTitle>{isFeatureRequest ? "Request a Feature" : "Report a Bug"}</DialogTitle>
              <DialogDescription>
                {isFeatureRequest
                  ? "Tell us what feature you'd like to see in Servio"
                  : "Help us improve by reporting any issues you've encountered"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">
              {isFeatureRequest ? "Feature Title" : "Bug Title"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              placeholder={
                isFeatureRequest
                  ? "e.g., Add customer loyalty program"
                  : "e.g., Orders not appearing in dashboard"
              }
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {isFeatureRequest ? "Description" : "What happened?"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder={
                isFeatureRequest
                  ? "Describe the feature you'd like to see. How would it help your business?"

              }
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={5}
              disabled={loading}
              className="resize-none"
            />
          </div>

          {!isFeatureRequest && (
            <div className="space-y-2">
              <Label htmlFor="steps">Steps to Reproduce (Optional)</Label>
              <Textarea
                id="steps"
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error..."
                value={formData.steps}
                onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                rows={4}
                disabled={loading}
                className="resize-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({ subject: "", description: "", steps: "" });
                onOpenChange(false);
              }}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.subject || !formData.description}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
