"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MessageSquare,
  Star,
  BarChart3,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { FeedbackQuestion, FeedbackType } from "@/types/feedback";

interface QuestionsClientProps {
  venueId: string;
  venueName?: string;
  mode?: "form-only" | "list-only" | "full" | "embedded";
}

export default function QuestionsClient({
  venueId,
  venueName: _venueName,
  mode = "full",
}: QuestionsClientProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "create">("overview");
  const { toast } = useToast();

  // Log venueId on mount for debugging
  useEffect(() => {
    if (!venueId) {
      // Venue ID not provided
    }
  }, [venueId]);

  // Clear editing state if the edited question no longer exists
  useEffect(() => {
    if (editingId && !questions.find((q) => q.id === editingId)) {
      resetForm();
    }
  }, [questions, editingId]);

  // Note: Removed auto-switching to "create" tab - user prefers to stay on "overview" by default

  // Form state
  const [formData, setFormData] = useState({
    prompt: "",
    type: "stars" as FeedbackType,
    choices: ["", ""],
    is_active: true,
  });

  const resetForm = () => {
    setFormData({
      prompt: "",
      type: "stars",
      choices: ["", ""],
      is_active: true,
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const fetchQuestions = useCallback(async () => {
    if (!venueId) {
      return;
    }

    try {
      setLoading(true);

      // Normalize venueId - database stores with venue- prefix
      const normalizedVenueId = venueId.startsWith("venue-") ? venueId : `venue-${venueId}`;

      // Use API endpoint instead of direct Supabase query to get properly mapped data
      const response = await fetch(`/api/feedback/questions?venueId=${normalizedVenueId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        // Try to get error details from response
        let errorMessage = `Failed to fetch questions: ${response.statusText}`;
        let errorDetails: unknown = null;
        try {
          const errorData = await response.json();
          errorMessage =
            errorData.message ||
            errorData.error?.message ||
            (typeof errorData.error === "string" ? errorData.error : null) ||
            errorData.details ||
            errorMessage;
          errorDetails = errorData;
          console.error("[QuestionsClient] API error response:", {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url: response.url,
            venueId: normalizedVenueId,
          });
        } catch {
          // If response isn't JSON, use status text
          console.error("[QuestionsClient] API error (non-JSON):", {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            venueId: normalizedVenueId,
          });
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (!data.success || !data.data?.questions) {
        throw new Error("Invalid response format");
      }

      // Ensure all questions have required fields with defaults
      // Filter out questions without valid prompts (shouldn't happen, but safety check)
      const transformedQuestions = (data.data.questions as FeedbackQuestion[])
        .filter((q: FeedbackQuestion) => {
          // Only include questions with valid prompts
          if (!q.prompt || q.prompt.trim().length === 0) {
            console.warn("[QuestionsClient] Question missing prompt, filtering out:", q.id);
            return false;
          }
          return true;
        })
        .map((q: FeedbackQuestion) => ({
          ...q,
          type: (q.type || "stars") as FeedbackType, // Ensure type is always valid
          prompt: q.prompt.trim(), // Ensure prompt is trimmed and never empty
          is_active: q.is_active ?? true, // Default to active
          sort_index: q.sort_index ?? 0, // Default sort_index
          choices: q.choices || [], // Ensure choices is an array
          created_at: q.created_at || new Date().toISOString(),
          updated_at: q.updated_at || new Date().toISOString(),
          venue_id: q.venue_id || venueId,
        }));

      // Sort questions by sort_index and created_at to ensure proper order
      const sortedQuestions = transformedQuestions.sort(
        (a: FeedbackQuestion, b: FeedbackQuestion) => {
          if (a.sort_index !== b.sort_index) {
            return (a.sort_index || 0) - (b.sort_index || 0);
          }
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
      );

      setQuestions(sortedQuestions);
      setTotalCount(data.data.totalCount || sortedQuestions.length);
    } catch (error) {
      console.error("[QuestionsClient] Error fetching questions:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Couldn't load questions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, toast]);

  // Load questions on mount
  useEffect(() => {
    if (venueId) {
      fetchQuestions();
    }
  }, [venueId, fetchQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!venueId) {
      toast({
        title: "Error",
        description: "Venue ID is missing. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question prompt",
        variant: "destructive",
      });
      return;
    }

    if (
      formData.type === "multiple_choice" &&
      formData.choices.filter((c) => c.trim()).length < 2
    ) {
      toast({
        title: "Error",
        description: "Multiple choice questions need at least 2 options",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Debug log

      if (!venueId) {
        toast({
          title: "Error",
          description: "Venue ID is missing. Please refresh the page.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const payload = {
        venue_id: venueId,
        prompt: formData.prompt.trim(),
        type: formData.type,
        choices:
          formData.type === "multiple_choice"
            ? formData.choices.filter((c) => c.trim())
            : undefined,
        is_active: formData.is_active,
      };

      // Add venueId to query string to help withUnifiedAuth extract it
      const url = new URL("/api/feedback/questions", window.location.origin);
      url.searchParams.set("venueId", venueId);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, it's likely a server error
        console.error("[QuestionsClient] Failed to parse response:", parseError);
        toast({
          title: "Error",
          description: `Server error (${response.status}). Please try again.`,
          variant: "destructive",
        });
        return;
      }

      // Check if response is successful and has the expected structure
      if (response.ok && responseData.success && responseData.data?.question) {
        toast({
          title: "Success",
          description: "Question added successfully",
        });

        // Refresh questions list first to show the new question
        await fetchQuestions();

        // Then reset form and switch to overview tab to show the new question
        resetForm();
        setActiveTab("overview");

        // Dispatch event to notify other components
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("feedbackQuestionsUpdated"));
        }
      } else {
        // Handle API error response format: { success: false, error: { message: "..." } }
        let errorMessage = "Couldn't save question";

        // Check for error in standard API response format
        if (responseData?.error?.message) {
          errorMessage = responseData.error.message;
        } else if (responseData?.message) {
          errorMessage = responseData.message;
        } else if (typeof responseData?.error === "string") {
          errorMessage = responseData.error;
        } else if (!response.ok) {
          // If response is not ok, check status code
          if (response.status === 500) {
            errorMessage = "Server error. Please try again or contact support.";
          } else if (response.status === 403) {
            errorMessage = "Permission denied. Please check your access.";
          } else if (response.status === 400) {
            errorMessage = "Invalid request. Please check your input.";
          } else if (response.status === 429) {
            errorMessage = "Too many requests. Please wait a moment and try again.";
          }
        } else if (response.ok && !responseData.success) {
          // Response is ok but success is false
          errorMessage = responseData?.error?.message || "Failed to create question";
        } else if (response.ok && responseData.success && !responseData.data?.question) {
          // Response is ok and success is true, but missing question data
          errorMessage =
            "Question created but response format is invalid. Please refresh the page.";
        }

        // Use console.error for client-side debugging (logger is server-side)
        console.error("[QuestionsClient] API error", {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          hasQuestion: !!responseData?.data?.question,
        });

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      // Catch network errors or JSON parsing errors
      const errorMessage =
        error instanceof Error
          ? `Network error: ${error.message}`
          : "Couldn't save question. Please check your connection and try again.";

      console.error("[QuestionsClient] Error creating question:", error);

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question prompt",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        id,
        venue_id: venueId,
        prompt: formData.prompt.trim(),
        type: formData.type,
        choices:
          formData.type === "multiple_choice"
            ? formData.choices.filter((c) => c.trim())
            : undefined,
      };

      // Add venueId to query string to help withUnifiedAuth extract it
      const url = new URL("/api/feedback/questions", window.location.origin);
      url.searchParams.set("venueId", venueId);

      const response = await fetch(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Question updated successfully",
        });
        resetForm();
        await fetchQuestions();
        setActiveTab("questions");

        // Dispatch event to notify other components
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("feedbackQuestionsUpdated"));
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Couldn't update question",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Couldn't update question",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch("/api/feedback/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, venue_id: venueId, is_active: !isActive }),
      });

      if (response.ok) {
        setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_active: !isActive } : q)));
      } else {
        toast({
          title: "Error",
          description: "Couldn't update question",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Couldn't update question",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;

    try {
      const response = await fetch("/api/feedback/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, venue_id: venueId }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Question deleted successfully",
        });

        // Clear editing state if the deleted question was being edited
        if (editingId === id) {
          resetForm();
        }

        await fetchQuestions();

        // Dispatch event to notify other components
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("feedbackQuestionsUpdated"));
        }
      } else {
        toast({
          title: "Error",
          description: "Couldn't delete question",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Couldn't delete question",
        variant: "destructive",
      });
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    const currentIndex = questions.findIndex((q) => q.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const currentQuestion = questions[currentIndex];
    const targetQuestion = questions[newIndex];

    try {
      const response = await fetch("/api/feedback/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: currentQuestion.id,
          venue_id: venueId,
          sort_index: targetQuestion.sort_index,
        }),
      });

      if (response.ok) {
        await fetchQuestions();
      } else {
        toast({
          title: "Error",
          description: "Couldn't reorder questions",
          variant: "destructive",
        });
      }
    } catch (_error) {
      toast({
        title: "Error",
        description: "Couldn't reorder questions",
        variant: "destructive",
      });
    }
  };

  const startEdit = (question: FeedbackQuestion) => {
    setFormData({
      prompt: question.prompt,
      type: question.type,
      choices: question.choices || ["", ""],
      is_active: question.is_active,
    });
    setEditingId(question.id);
    setShowAddForm(true);
    setActiveTab("create");
  };

  const addChoice = () => {
    if (formData.choices.length >= 6) return;
    setFormData((prev) => ({
      ...prev,
      choices: [...prev.choices, ""],
    }));
  };

  const removeChoice = (index: number) => {
    if (formData.choices.length <= 2) return;
    setFormData((prev) => ({
      ...prev,
      choices: prev.choices.filter((_, i) => i !== index),
    }));
  };

  const updateChoice = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      choices: prev.choices.map((choice, i) => (i === index ? value : choice)),
    }));
  };

  const getTypeBadge = (type: FeedbackType | string | undefined) => {
    const variants = {
      stars: { label: "Star Rating", variant: "default" as const },
      multiple_choice: { label: "Multiple Choice", variant: "secondary" as const },
      paragraph: { label: "Paragraph", variant: "outline" as const },
    };
    // Safety check: if type is invalid or missing, default to "stars"
    const validType = type && variants[type as FeedbackType] ? (type as FeedbackType) : "stars";
    const config = variants[validType];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
        <Eye className="h-3 w-3 mr-1" />
        Active
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-gray-100 text-gray-900 hover:bg-gray-100">
        <EyeOff className="h-3 w-3 mr-1" />
        Inactive
      </Badge>
    );
  };

  const activeQuestions = questions.filter((q) => q.is_active);
  const inactiveQuestions = questions.filter((q) => !q.is_active);

  // When in embedded mode, just show the question management interface without tabs
  if (mode === "embedded") {
    return (
      <div className="space-y-6">
        {/* Question List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Manage Questions</span>
              <Button onClick={() => setShowAddForm(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No questions yet</p>
                <p className="text-sm mt-2">Create your first feedback question</p>
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((question) => (
                  <Card key={question.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground">
                            {question.prompt}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {getTypeBadge(question?.type)}
                            {getStatusBadge(question?.is_active ?? true)}
                          </div>
                          {question?.type === "multiple_choice" &&
                            question?.choices &&
                            question.choices.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {question.choices.map((choice, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {choice}
                                  </Badge>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleToggleActive(question.id, !(question?.is_active ?? true))
                            }
                            title={(question?.is_active ?? true) ? "Deactivate" : "Activate"}
                          >
                            {(question?.is_active ?? true) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(question)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(question.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Form */}
        {(showAddForm || editingId) && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Question" : "Create New Question"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Question Prompt *</Label>
                  <Textarea
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="How would you rate your experience?"
                    rows={2}
                    required
                  />
                </div>

                <div>
                  <Label>Question Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: FeedbackType) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stars">Star Rating (1-5)</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="paragraph">Paragraph</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "multiple_choice" && (
                  <div>
                    <Label>Choices (2-6) *</Label>
                    {formData.choices.map((choice, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Input
                          value={choice}
                          onChange={(e) => {
                            const newChoices = [...formData.choices];
                            newChoices[index] = e.target.value;
                            setFormData({ ...formData, choices: newChoices });
                          }}
                          placeholder={`Choice ${index + 1}`}
                          maxLength={40}
                        />
                        {formData.choices.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newChoices = formData.choices.filter((_, i) => i !== index);
                              setFormData({ ...formData, choices: newChoices });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {formData.choices.length < 6 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormData({ ...formData, choices: [...formData.choices, ""] })
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Choice
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Label>Status</Label>
                  <ToggleSwitch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {formData.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Saving..." : editingId ? "Update Question" : "Add Question"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full mode with tabs and stats
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Total Questions</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Active</p>
                <p className="text-2xl font-bold">{activeQuestions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-500">Inactive</p>
                <p className="text-2xl font-bold">{inactiveQuestions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "overview" | "questions" | "create")}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="questions">All Feedback</TabsTrigger>
          <TabsTrigger value="create">Create Question</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feedback Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Active Questions ({activeQuestions.length})</h4>
                  <div className="space-y-2">
                    {activeQuestions.slice(0, 3).map((question) => (
                      <div
                        key={question.id}
                        className="flex items-center justify-between p-2 bg-green-50 rounded"
                      >
                        <span className="text-sm">{question.prompt}</span>
                        {getTypeBadge(question.type)}
                      </div>
                    ))}
                    {activeQuestions.length > 3 && (
                      <p className="text-sm text-gray-500">+{activeQuestions.length - 3} more...</p>
                    )}
                    {activeQuestions.length === 0 && (
                      <p className="text-sm text-gray-500">No active questions yet</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Recent Activity</h4>
                  <div className="text-sm text-gray-500">
                    <p>• {totalCount} total questions created</p>
                    <p>• {activeQuestions.length} currently active</p>
                    <p>• Questions help collect customer feedback</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Feedback Questions ({questions.length})</CardTitle>
              <Button
                onClick={() => {
                  setShowAddForm(true);
                  setActiveTab("create");
                }}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 mb-4">No feedback questions yet</p>
                  <Button onClick={() => setActiveTab("create")}>Create Your First Question</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <Card
                      key={question.id}
                      className="border-0 shadow-sm bg-white/50 dark:bg-gray-900/50 hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                                <span className="font-medium">{index + 1}.</span>
                              </div>
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                {question.prompt}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2">
                              {getTypeBadge(question.type)}
                              {getStatusBadge(question.is_active)}
                            </div>

                            {question.type === "multiple_choice" && question.choices && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium">Choices:</span>{" "}
                                {question.choices.join(", ")}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReorder(question.id, "up")}
                              disabled={index === 0}
                              className="h-8 w-8 p-0"
                            >
                              ↑
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReorder(question.id, "down")}
                              disabled={index === questions.length - 1}
                              className="h-8 w-8 p-0"
                            >
                              ↓
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(question.id, question.is_active)}
                              className="h-8 w-8 p-0"
                            >
                              {question.is_active ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEdit(question)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(question.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit Question" : "Create New Question"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={
                  editingId
                    ? (e) => {
                        e.preventDefault();
                        handleUpdate(editingId);
                      }
                    : handleSubmit
                }
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="prompt" className="text-sm font-medium">
                    Question Prompt *
                  </Label>
                  <Textarea
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData((prev) => ({ ...prev, prompt: e.target.value }))}
                    placeholder="Enter your question (4-160 characters)"
                    maxLength={160}
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.prompt.length}/160 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium">
                    Question Type *
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: FeedbackType) =>
                      setFormData((prev) => ({ ...prev, type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stars">Star Rating (1-5)</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="paragraph">Paragraph</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === "multiple_choice" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Choices * (2-6 options, max 40 chars each)
                    </Label>
                    <div className="space-y-2">
                      {formData.choices.map((choice, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            value={choice}
                            onChange={(e) => updateChoice(index, e.target.value)}
                            placeholder={`Choice ${index + 1}`}
                            maxLength={40}
                          />
                          {formData.choices.length > 2 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeChoice(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {formData.choices.length < 6 && (
                        <Button type="button" variant="outline" size="sm" onClick={addChoice}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Choice
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Label className="text-sm font-medium text-gray-700">Status</Label>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_active: checked }))
                      }
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {formData.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? "Saving..." : editingId ? "Update Question" : "Add Question"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel Edit
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Mobile Navigation - Temporarily disabled */}
      {/* <MobileNav 
        venueId={venueId}
        venueName={venueName}
        counts={{
          live_orders: 0,
          total_orders: 0,
          notifications: 0
        }}
      /> */}
    </div>
  );
}
