"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import type { FeedbackQuestion, FeedbackType } from '@/types/feedback';

interface QuestionsClientProps {
  venueId: string;
  initialQuestions: FeedbackQuestion[];
}

export default function QuestionsClient({ venueId, initialQuestions }: QuestionsClientProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(initialQuestions);
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
      const response = await fetch(`/api/feedback/questions?venueId=${venueId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      } else {
        toast({
          title: "Error",
          description: "Couldn't load questions",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Couldn't load questions",
        variant: "destructive"
      });
    }
  };

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
        toast({
          title: "Success",
          description: "Question added successfully"
        });
        resetForm();
        fetchQuestions();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Couldn't save question",
          variant: "destructive"
        });
      }
    } catch (error) {
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

  return (
    <div className="space-y-6">
      {/* Add Question Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{editingId ? 'Edit Question' : 'Add New Question'}</span>
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
          </CardTitle>
        </CardHeader>
        {showAddForm && (
          <CardContent>
            <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId); } : handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prompt">Question Prompt *</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Enter your question (4-160 characters)"
                  maxLength={160}
                  rows={2}
                />
                <p className="text-sm text-gray-500">
                  {formData.prompt.length}/160 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Question Type *</Label>
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
                  <Label>Choices * (2-6 options, max 40 chars each)</Label>
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

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
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
        )}
      </Card>

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No questions yet. Add your first feedback question above.
            </p>
          ) : (
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div key={question.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-500">
                        {index + 1}.
                      </span>
                      <span className="font-medium">{question.prompt}</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {question.type}
                      </span>
                      {question.is_active ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(question.id, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(question.id, 'down')}
                        disabled={index === questions.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(question.id, question.is_active)}
                      >
                        {question.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(question)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(question.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {question.type === 'multiple_choice' && question.choices && (
                    <div className="text-sm text-gray-600">
                      Choices: {question.choices.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
