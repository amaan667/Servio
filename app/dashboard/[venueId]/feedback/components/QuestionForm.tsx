"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeedbackType } from "@/types/feedback";

interface QuestionFormProps {
  formData: {
    prompt: string;
    type: FeedbackType;
    choices: string[];
    is_active: boolean;
  };
  editingId: string | null;
  loading: boolean;
  onFormDataChange: (data: {
    prompt: string;
    type: FeedbackType;
    choices: string[];
    is_active: boolean;
  }) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
}

export function QuestionForm({
  formData,
  editingId,
  loading,
  onFormDataChange,
  onSubmit,
  onCancel,
}: QuestionFormProps) {
  const updateChoice = (index: number, value: string) => {
    const newChoices = [...formData.choices];
    newChoices[index] = value;
    onFormDataChange({ ...formData, choices: newChoices });
  };

  const addChoice = () => {
    onFormDataChange({ ...formData, choices: [...formData.choices, ""] });
  };

  const removeChoice = (index: number) => {
    if (formData.choices.length > 2) {
      const newChoices = formData.choices.filter((_, i) => i !== index);
      onFormDataChange({ ...formData, choices: newChoices });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingId ? "Edit Question" : "Create New Question"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="prompt">Question Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., How was your experience today?"
              value={formData.prompt}
              onChange={(e) => onFormDataChange({ ...formData, prompt: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div>
            <Label htmlFor="type">Question Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: FeedbackType) =>
                onFormDataChange({ ...formData, type: value })
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stars">Star Rating</SelectItem>
                <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                <SelectItem value="paragraph">Paragraph</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.type === "multiple_choice" && (
            <div>
              <Label>Choices</Label>
              <div className="space-y-2 mt-1">
                {formData.choices.map((choice, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={choice}
                      onChange={(e) => updateChoice(index, e.target.value)}
                      placeholder={`Choice ${index + 1}`}
                    />
                    {formData.choices.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeChoice(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addChoice}>
                  Add Choice
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ToggleSwitch
                checked={formData.is_active}
                onCheckedChange={(checked) => onFormDataChange({ ...formData, is_active: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingId ? "Update Question" : "Create Question"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
