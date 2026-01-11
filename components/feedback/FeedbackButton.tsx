"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageSquare, Bug, Lightbulb, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type FeedbackType = "bug" | "feature" | "general";

interface FeedbackButtonProps {
  type: FeedbackType;
  className?: string;
}

export function FeedbackButton({ type, className }: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const config = {
    bug: {
      icon: Bug,
      title: "Report a Bug",
      description: "Help us improve by reporting issues you encounter",
      placeholder: "Describe the bug you encountered...",
      buttonText: "Report Bug",
      color: "destructive" as const,
      bgColor: "bg-red-50 hover:bg-red-100 text-red-700 border-red-200",
    },
    feature: {
      icon: Lightbulb,
      title: "Request a Feature",
      description: "Share your ideas to make Servio better",
      placeholder: "Describe the feature you'd like to see...",
      buttonText: "Request Feature",
      color: "default" as const,
      bgColor: "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    general: {
      icon: MessageSquare,
      title: "Send Feedback",
      description: "Share your thoughts about Servio",
      placeholder: "Your feedback...",
      buttonText: "Send Feedback",
      color: "default" as const,
      bgColor: "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200",
    },
  };

  const { icon: Icon, bgColor, ...typeConfig } = config[type];

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a description",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/pilot-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title:
            title ||
            `${type === "bug" ? "Bug Report" : type === "feature" ? "Feature Request" : "Feedback"}`,
          description,
          email,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error("Failed to submit feedback");

      toast({
        title: "Thank you!",
        description: "Your feedback has been submitted successfully",
      });

      setTitle("");
      setDescription("");
      setEmail("");
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={`${bgColor} ${className}`}>
          <Icon className="h-4 w-4 mr-2" />
          {typeConfig.buttonText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {typeConfig.title}
          </DialogTitle>
          <DialogDescription>{typeConfig.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title (Optional)</Label>
            <Input
              id="title"
              placeholder={`Brief summary...`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder={typeConfig.placeholder}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (Optional)</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">We'll use this to follow up if needed</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
