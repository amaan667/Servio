"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, MessageSquare, Settings } from "lucide-react";
import { supabase } from "@/lib/sb-client";

interface CustomQuestion {
  id: string;
  question: string;
  question_type: 'rating' | 'text' | 'multiple_choice';
  options?: string[];
  active: boolean;
  created_at: string;
}

interface QuestionResponse {
  id: string;
  question_id: string;
  response: string;
  rating?: number;
  customer_name?: string;
  comments?: string;
  created_at: string;
  feedback_questions: CustomQuestion;
}

interface FeedbackClientProps {
  venueId: string;
  customQuestions: CustomQuestion[];
  questionResponses: QuestionResponse[];
}

export default function FeedbackClient({ 
  venueId, 
  customQuestions: initialCustomQuestions, 
  questionResponses: initialQuestionResponses 
}: FeedbackClientProps) {
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [questionType, setQuestionType] = useState<'rating' | 'text' | 'multiple_choice'>('rating');
  const [options, setOptions] = useState<string[]>(['']);
  const [activeTab, setActiveTab] = useState<'questions' | 'responses'>('responses');
  const [customQuestions, setCustomQuestions] = useState(initialCustomQuestions);
  const [questionResponses, setQuestionResponses] = useState(initialQuestionResponses);
  const [isAdding, setIsAdding] = useState(false);

  const addQuestion = async () => {
    if (!newQuestion.trim() || isAdding) return;

    setIsAdding(true);
    try {
      const questionData = {
        venue_id: venueId,
        question: newQuestion.trim(),
        question_type: questionType,
        options: questionType === 'multiple_choice' ? options.filter(o => o.trim()) : null,
        active: true
      };

      console.log('[FEEDBACK_CLIENT] Adding question:', questionData);

      // Use the API route instead of direct Supabase client to bypass RLS
      const response = await fetch('/api/feedback/add-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(questionData)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        console.error('[FEEDBACK_CLIENT] Error adding question:', result.error);
        alert(`Failed to add question: ${result.error || 'Unknown error'}`);
        return;
      }

      console.log('[FEEDBACK_CLIENT] Successfully added question:', result.data);

      // Add the new question to the state
      setCustomQuestions(prev => [result.data, ...prev]);
      
      // Reset form
      setNewQuestion("");
      setQuestionType('rating');
      setOptions(['']);
      setShowAddQuestion(false);
      
      // Switch to questions tab to show the new question
      setActiveTab('questions');
      
    } catch (error) {
      console.error('[FEEDBACK_CLIENT] Error adding question:', error);
      alert('Failed to add question. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const toggleQuestionActive = async (questionId: string, currentActive: boolean) => {
    try {
      const response = await fetch('/api/feedback/toggle-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          active: !currentActive
        })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        console.error('[FEEDBACK_CLIENT] Error toggling question:', result.error);
        alert(`Failed to update question: ${result.error || 'Unknown error'}`);
        return;
      }

      // Update the question in state
      setCustomQuestions(prev => 
        prev.map(q => 
          q.id === questionId 
            ? { ...q, active: !currentActive }
            : q
        )
      );
    } catch (error) {
      console.error('[FEEDBACK_CLIENT] Error toggling question:', error);
      alert('Failed to update question. Please try again.');
    }
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  // Group responses by customer session (assuming responses with same timestamp are from same customer)
  const groupedResponses = questionResponses.reduce((groups: any, response) => {
    const date = new Date(response.created_at).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(response);
    return groups;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customer Feedback</h1>
        <Button onClick={() => setShowAddQuestion(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('responses')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'responses' ? 'bg-white shadow-sm' : 'text-gray-600'
          }`}
        >
          <MessageSquare className="h-4 w-4 inline mr-2" />
          Responses ({questionResponses.length})
        </button>
        <button
          onClick={() => setActiveTab('questions')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'questions' ? 'bg-white shadow-sm' : 'text-gray-600'
          }`}
        >
          <Settings className="h-4 w-4 inline mr-2" />
          Questions ({customQuestions.length})
        </button>
      </div>

      {/* Add Question Modal */}
      {showAddQuestion && (
        <Card>
          <CardHeader>
            <CardTitle>Add Custom Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Question</label>
              <Input
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="e.g., How was the service speed?"
                disabled={isAdding}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Question Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-full border rounded-md px-3 py-2"
                disabled={isAdding}
              >
                <option value="rating">Rating (1-5 stars)</option>
                <option value="text">Text Response</option>
                <option value="multiple_choice">Multiple Choice</option>
              </select>
            </div>

            {questionType === 'multiple_choice' && (
              <div>
                <label className="block text-sm font-medium mb-2">Options</label>
                {options.map((option, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      disabled={isAdding}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption(index)}
                      disabled={options.length === 1 || isAdding}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption} disabled={isAdding}>
                  Add Option
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={addQuestion} disabled={isAdding || !newQuestion.trim()}>
                {isAdding ? 'Adding...' : 'Add Question'}
              </Button>
              <Button variant="outline" onClick={() => setShowAddQuestion(false)} disabled={isAdding}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <div className="space-y-6">
          {Object.keys(groupedResponses).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Feedback Yet</h3>
                <p className="text-gray-600">Customer feedback will appear here once they start responding to your questions.</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedResponses).map(([date, responses]: [string, any]) => (
              <Card key={date}>
                <CardHeader>
                  <CardTitle className="text-lg">Feedback from {date}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {responses.map((response: QuestionResponse) => (
                    <div key={response.id} className="border-l-4 border-blue-200 pl-4">
                      <div className="mb-2">
                        <h4 className="font-medium text-gray-900">
                          {response.feedback_questions.question}
                        </h4>
                      </div>
                      
                      <div className="mb-2">
                        {response.feedback_questions.question_type === 'rating' && response.rating ? (
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <span key={n} className={n <= response.rating! ? 'text-yellow-400' : 'text-gray-300'}>
                                ★
                              </span>
                            ))}
                            <span className="ml-2 text-sm text-gray-600">({response.rating}/5)</span>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-700">{response.response}</div>
                        )}
                      </div>

                      {response.customer_name && (
                        <div className="text-sm text-gray-600 mb-1">
                          <strong>Name:</strong> {response.customer_name}
                        </div>
                      )}

                      {response.comments && (
                        <div className="text-sm text-gray-700 mb-2">
                          <strong>Comments:</strong> {response.comments}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {new Date(response.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-3">
          {customQuestions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Custom Questions</h3>
                <p className="text-gray-600">Create custom questions to gather specific feedback from customers.</p>
              </CardContent>
            </Card>
          ) : (
            customQuestions.map((question) => (
              <Card key={question.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">{question.question}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={question.active ? "default" : "secondary"}>
                        {question.active ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleQuestionActive(question.id, question.active)}
                      >
                        {question.active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    Type: {question.question_type.replace('_', ' ')}
                  </div>
                  {question.options && question.options.length > 0 && (
                    <div className="text-sm text-gray-600">
                      Options: {question.options.join(', ')}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-2">
                    Created: {new Date(question.created_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
