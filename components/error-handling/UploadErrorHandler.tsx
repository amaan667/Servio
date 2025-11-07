"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface UploadErrorHandlerProps {
  error: Error | null;
  onRetry: () => void;
  onDismiss: () => void;
}

export function UploadErrorHandler({ error, onRetry, onDismiss }: UploadErrorHandlerProps) {
  if (!error) return null;

  const getErrorMessage = (err: Error) => {
    const message = err.message.toLowerCase();

    if (message.includes("network") || message.includes("fetch")) {
      return {
        title: "Network Error",
        description: "Unable to upload. Check your internet connection and try again.",
      };
    }

    if (message.includes("size") || message.includes("large")) {
      return {
        title: "File Too Large",
        description: "The file is too large. Please try a smaller file (max 10MB).",
      };
    }

    if (message.includes("format") || message.includes("type")) {
      return {
        title: "Invalid File Type",
        description: "This file type is not supported. Please use JPG, PNG, or PDF.",
      };
    }

    return {
      title: "Upload Failed",
      description: err.message || "An error occurred while uploading. Please try again.",
    };
  };

  const { title, description } = getErrorMessage(error);

  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="mb-3">{description}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
