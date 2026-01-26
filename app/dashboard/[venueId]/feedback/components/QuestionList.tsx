"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";
import type { FeedbackQuestion } from "@/types/feedback";

interface QuestionListProps {
  questions: FeedbackQuestion[];
  onEdit: (question: FeedbackQuestion) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  loading: boolean;
}

export function QuestionList({
  questions,
  onEdit,
  onDelete,
  onToggleActive,
  loading,
}: QuestionListProps) {
  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No questions yet. Create your first question to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <Card key={question.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold">{question.prompt}</h3>
                  <Badge variant={question.is_active ? "default" : "secondary"}>
                    {question.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {question.type.replace("_", " ")}
                  </Badge>
                </div>
                {question.type === "multiple_choice" && question.choices && (
                  <div className="ml-6 mt-2">
                    <p className="text-sm text-muted-foreground mb-1">Choices:</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {question.choices.map((choice, idx) => (
                        <li key={idx}>{choice}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleActive(question.id, !question.is_active)}
                  disabled={loading}
                >
                  {question.is_active ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => onEdit(question)} disabled={loading}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(question.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
