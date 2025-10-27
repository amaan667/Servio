import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Undo2, Loader2, Check, AlertTriangle } from "lucide-react";
import { ChatMessage } from "../types";

interface MessageListProps {
  messages: ChatMessage[];
  undoing: string | null;
  onUndo: (messageId: string, auditId: string) => void;
}

export function MessageList({ messages, undoing, onUndo }: MessageListProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <Card
            key={message.id}
            className={`${
              message.role === "user"
                ? "bg-purple-50 dark:bg-purple-900/20 ml-auto max-w-[80%]"
                : "bg-white dark:bg-gray-800 mr-auto max-w-[80%]"
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={message.role === "user" ? "default" : "secondary"}>
                  {message.role === "user" ? "You" : "AI Assistant"}
                </Badge>
                {message.canUndo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onUndo(message.id, message.auditId!)}
                    disabled={undoing === message.id}
                  >
                    {undoing === message.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Undo2 className="h-4 w-4" />
                    )}
                    Undo
                  </Button>
                )}
              </div>
              <p className="text-sm">{message.content}</p>
              {
                (message.executionResult && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-xs text-green-800 dark:text-green-200">
                        Action completed successfully
                      </span>
                    </div>
                  </div>
                )) as React.ReactNode
              }
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
