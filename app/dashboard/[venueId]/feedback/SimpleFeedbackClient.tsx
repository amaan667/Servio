"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, MessageSquare, Star, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FeedbackQuestion {
  id: string;
  prompt: string;
  type: 'stars' | 'multiple_choice' | 'paragraph';
  choices?: string[];
  is_active: boolean;
  sort_index: number;
}

interface SimpleFeedbackClientProps {
  venueId: string;
}

export default function SimpleFeedbackClient({ venueId }: SimpleFeedbackClientProps) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'feedback' | 'create'>('overview');
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    prompt: '',
    type: 'stars' as 'stars' | 'multiple_choice' | 'paragraph',
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
        setTotalCount(data.totalCount || 0);
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

    setLoading(true);
    try {
      const url = editingId 
        ? `/api/feedback/questions/${editingId}` 
        : '/api/feedback/questions';
      
      const method = editingId ? 'PUT' : 'POST';
      
      const payload = {
        prompt: formData.prompt.trim(),
        type: formData.type,
        choices: formData.type === 'multiple_choice' ? formData.choices.filter(c => c.trim()) : undefined,
        is_active: formData.is_active,
        venue_id: venueId
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: editingId ? "Question updated" : "Question created"
        });
        resetForm();
        fetchQuestions();
      } else {
        const error = await response.text();
        toast({
          title: "Error",
          description: error || "Failed to save question",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save question",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (question: FeedbackQuestion) => {
    setFormData({
      prompt: question.prompt,
      type: question.type,
      choices: question.choices || ['', ''],
      is_active: question.is_active
    });
    setEditingId(question.id);
    setShowAddForm(true);
    setActiveTab('create');
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/feedback/questions/${questionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Question deleted"
        });
        fetchQuestions();
      } else {
        toast({
          title: "Error",
          description: "Failed to delete question",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (questionId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/feedback/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !currentStatus,
          venue_id: venueId
        })
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Question ${!currentStatus ? 'activated' : 'deactivated'}`
        });
        fetchQuestions();
      } else {
        toast({
          title: "Error",
          description: "Failed to update question",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update question",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const activeQuestions = questions.filter(q => q.is_active);
  const inactiveQuestions = questions.filter(q => !q.is_active);

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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as unknown)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="feedback">All Questions</TabsTrigger>
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
                      <div key={question.id} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span className="text-sm">{question.prompt}</span>
                        <Badge variant="secondary" className="text-xs">
                          {question.type === 'stars' ? 'Star Rating' : 
                           question.type === 'multiple_choice' ? 'Multiple Choice' : 'Text'}
                        </Badge>
                      </div>
                    ))}
                    {activeQuestions.length > 3 && (
                      <p className="text-sm text-gray-500">+{activeQuestions.length - 3} more...</p>
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

        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Questions</CardTitle>
              <Button 
                onClick={() => {
                  setShowAddForm(true);
                  setActiveTab('create');
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
                  <Button onClick={() => setActiveTab('create')}>
                    Create Your First Question
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((question) => (
                    <div key={question.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{question.prompt}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant={question.is_active ? "default" : "secondary"}>
                            {question.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {question.type === 'stars' ? 'Star Rating' : 
                             question.type === 'multiple_choice' ? 'Multiple Choice' : 'Text'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(question.id, question.is_active)}
                          disabled={loading}
                        >
                          {question.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(question)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(question.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {editingId ? 'Edit Question' : 'Create New Question'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="prompt">Question Prompt</Label>
                  <Input
                    id="prompt"
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="e.g., How was your dining experience?"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="type">Question Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stars">Star Rating (1-5 stars)</SelectItem>
                      <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                      <SelectItem value="paragraph">Text Response</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.type === 'multiple_choice' && (
                  <div>
                    <Label>Answer Choices</Label>
                    <div className="space-y-2">
                      {formData.choices.map((choice, index) => (
                        <Input
                          key={index}
                          value={choice}
                          onChange={(e) => {
                            const newChoices = [...formData.choices];
                            newChoices[index] = e.target.value;
                            setFormData({ ...formData, choices: newChoices });
                          }}
                          placeholder={`Choice ${index + 1}`}
                        />
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData({ 
                          ...formData, 
                          choices: [...formData.choices, ''] 
                        })}
                      >
                        Add Choice
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="active">Active (customers will see this question)</Label>
                </div>

                <div className="flex space-x-2">
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : editingId ? 'Update Question' : 'Create Question'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
