"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff, X, Check, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { FeedbackQuestion, FeedbackType } from '@/types/feedback';
import { dbLogger } from '@/lib/logger';
// import MobileNav from '@/components/MobileNav';

interface QuestionsClientProps {
  venueId: string;
  venueName?: string;
  mode?: 'form-only' | 'list-only' | 'full';
}

export default function QuestionsClient({ venueId, venueName, mode = 'full' }: QuestionsClientProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  // Clear editing state if the edited question no longer exists
  useEffect(() => {
    if (editingId && !questions.find(q => q.id === editingId)) {
      resetForm();
    }
  }, [questions, editingId]);

  // Show form by default when there are no questions
  useEffect(() => {
    if (questions.length === 0 && !editingId) {
      setShowAddForm(true);
    }
  }, [questions.length, editingId]);

  // Form state
  const [formData, setFormData] = useState({
    prompt: '',
    type: 'stars' as FeedbackType,
    choices: ['', ''],
    is_active: true
  });

  const resetForm = () => {
    setFormData({
      prompt: '',
      type: 'stars',
      choices: ['', ''],
      is_active: true
    });
    setEditingId(null);
    setShowAddForm(false);
  };

  const fetchQuestions = async () => {
    try {
      console.debug('[FEEDBACK DEBUG] Fetching questions for venue:', venueId);
      
      const response = await fetch(`/api/feedback/questions?venueId=${venueId}`);
      console.debug('[FEEDBACK DEBUG] Fetch response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.debug('[FEEDBACK DEBUG] Fetched questions:', data);
        setQuestions(data.questions || []);
        setTotalCount(data.totalCount || 0);
      } else {
        console.error('[FEEDBACK DEBUG] Fetch failed:', response.status);
        toast({
          title: "Error",
          description: "Couldn't load questions",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[FEEDBACK DEBUG] Fetch exception:', error);
      toast({
        title: "Error",
        description: "Couldn't load questions",
        variant: "destructive"
      });
    }
  };

  // Load questions on mount
  useEffect(() => {
    fetchQuestions();
  }, [venueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    
    if (!formData.prompt.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question prompt",
        variant: "destructive"
      });
      return;
    }

    if (formData.type === 'multiple_choice' && formData.choices.filter(c => c.trim()).length < 2) {
      toast({
        title: "Error",
        description: "Multiple choice questions need at least 2 options",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        venue_id: venueId,
        prompt: formData.prompt.trim(),
        type: formData.type,
        choices: formData.type === 'multiple_choice' ? formData.choices.filter(c => c.trim()) : undefined,
        is_active: formData.is_active
      };


      const response = await fetch('/api/feedback/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });


      if (response.ok) {
        const result = await response.json();
        
        toast({
          title: "Success",
          description: "Question added successfully"
        });
        resetForm();
        fetchQuestions();
        
        // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('feedbackQuestionsUpdated'));
        }
      } else {
        const error = await response.json();
        
        toast({
          title: "Error",
          description: error.error || "Couldn't save question",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[FEEDBACK DEBUG] Exception:', error);
      toast({
        title: "Error",
        description: "Couldn't save question",
        variant: "destructive"
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
        variant: "destructive"
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
        choices: formData.type === 'multiple_choice' ? formData.choices.filter(c => c.trim()) : undefined
      };

      const response = await fetch('/api/feedback/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Question updated successfully"
        });
        resetForm();
        fetchQuestions();
        
        // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('feedbackQuestionsUpdated'));
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Couldn't update question",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't update question",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/feedback/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, venue_id: venueId, is_active: !isActive })
      });

      if (response.ok) {
        setQuestions(prev => prev.map(q => 
          q.id === id ? { ...q, is_active: !isActive } : q
        ));
      } else {
        toast({
          title: "Error",
          description: "Couldn't update question",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't update question",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      const response = await fetch('/api/feedback/questions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, venue_id: venueId })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Question deleted successfully"
        });
        
        // Clear editing state if the deleted question was being edited
        if (editingId === id) {
          resetForm();
        }
        
        fetchQuestions();
        
        // Dispatch event to notify other components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('feedbackQuestionsUpdated'));
        }
      } else {
        toast({
          title: "Error",
          description: "Couldn't delete question",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't delete question",
        variant: "destructive"
      });
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = questions.findIndex(q => q.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const currentQuestion = questions[currentIndex];
    const targetQuestion = questions[newIndex];

    try {
      const response = await fetch('/api/feedback/questions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentQuestion.id,
          venue_id: venueId,
          sort_index: targetQuestion.sort_index
        })
      });

      if (response.ok) {
        fetchQuestions();
      } else {
        toast({
          title: "Error",
          description: "Couldn't reorder questions",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't reorder questions",
        variant: "destructive"
      });
    }
  };

  const startEdit = (question: FeedbackQuestion) => {
    setFormData({
      prompt: question.prompt,
      type: question.type,
      choices: question.choices || ['', ''],
      is_active: question.is_active
    });
    setEditingId(question.id);
    setShowAddForm(true);
  };

  const addChoice = () => {
    if (formData.choices.length >= 6) return;
    setFormData(prev => ({
      ...prev,
      choices: [...prev.choices, '']
    }));
  };

  const removeChoice = (index: number) => {
    if (formData.choices.length <= 2) return;
    setFormData(prev => ({
      ...prev,
      choices: prev.choices.filter((_, i) => i !== index)
    }));
  };

  const updateChoice = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      choices: prev.choices.map((choice, i) => i === index ? value : choice)
    }));
  };

  const getTypeBadge = (type: FeedbackType) => {
    const variants = {
      stars: { label: 'Star Rating', variant: 'default' as const },
      multiple_choice: { label: 'Multiple Choice', variant: 'secondary' as const },
      paragraph: { label: 'Paragraph', variant: 'outline' as const }
    };
    const config = variants[type];
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

  return (
    <div className="space-y-6">
      {/* Feedback Stats */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{totalCount} feedback questions</span>
          </div>
          <span className="text-sm text-muted-foreground">•</span>
          <span className="text-sm text-muted-foreground">
            {questions.filter(q => q.is_active).length} active
          </span>
        </div>
      </div>

      {/* Add Question Form */}
      {(mode === 'form-only' || mode === 'full') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editingId ? 'Edit Question' : 'Add New Question'}
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (editingId) {
                  resetForm();
                } else {
                  setShowAddForm(!showAddForm);
                }
              }}
            >
              {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          
          {showAddForm && (
            <Card className="border-0 shadow-sm bg-white/50 dark:bg-gray-900/50">
              <CardContent className="p-6">
                <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt" className="text-sm font-medium">Question Prompt *</Label>
                    <Textarea
                      id="prompt"
                      value={formData.prompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
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
                    <Label htmlFor="type" className="text-sm font-medium">Question Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value: FeedbackType) => setFormData(prev => ({ ...prev, type: value }))}
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

                  {formData.type === 'multiple_choice' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Choices * (2-6 options, max 40 chars each)</Label>
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addChoice}
                          >
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
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {formData.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? 'Saving...' : (editingId ? 'Update Question' : 'Add Question')}
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
          )}
        </div>
      )}

      {/* Questions List */}
      {(mode === 'list-only' || mode === 'full') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Current Questions ({questions.length})</h3>
          </div>
          
          {questions.length === 0 ? (
            <Card className="border-0 shadow-sm bg-white/50 dark:bg-gray-900/50">
              <CardContent className="p-12 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-8 w-8 text-gray-700" />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">No questions yet</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create your first feedback question to start collecting customer insights
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <Card key={question.id} className="border-0 shadow-sm bg-white/50 dark:bg-gray-900/50 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                            <span className="font-medium">{index + 1}.</span>
                          </div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{question.prompt}</h4>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {getTypeBadge(question.type)}
                          {getStatusBadge(question.is_active)}
                        </div>
                        
                        {question.type === 'multiple_choice' && question.choices && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Choices:</span> {question.choices.join(', ')}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReorder(question.id, 'up')}
                          disabled={index === 0}
                          className="h-8 w-8 p-0"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReorder(question.id, 'down')}
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
                          {question.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
        </div>
      )}
      
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
