"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, MessageSquare, Settings } from "lucide-react";
import { supabase } from "@/lib/sb-client";

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  orders: { id: string; table_number: number };
}

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
  created_at: string;
  feedback_questions: CustomQuestion;
}

interface FeedbackClientProps {
  venueId: string;
  reviews: Review[];
  customQuestions: CustomQuestion[];
  questionResponses: QuestionResponse[];
}

export default function FeedbackClient({ 
  venueId, 
  reviews, 
  customQuestions, 
  questionResponses 
}: FeedbackClientProps) {
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [questionType, setQuestionType] = useState<'rating' | 'text' | 'multiple_choice'>('rating');
  const [options, setOptions] = useState<string[]>(['']);
  const [activeTab, setActiveTab] = useState<'reviews' | 'questions' | 'responses'>('reviews');

  const addQuestion = async () => {
    if (!newQuestion.trim()) return;

    const questionData = {
      venue_id: venueId,
      question: newQuestion.trim(),
      question_type: questionType,
      options: questionType === 'multiple_choice' ? options.filter(o => o.trim()) : null,
      active: true
    };

    const { error } = await supabase
      .from('feedback_questions')
      .insert(questionData);

    if (!error) {
      setNewQuestion("");
      setQuestionType('rating');
      setOptions(['']);
      setShowAddQuestion(false);
      window.location.reload();
    }
  };

  const toggleQuestionActive = async (questionId: string, currentActive: boolean) => {
    await supabase
      .from('feedback_questions')
      .update({ active: !currentActive })
      .eq('id', questionId);
    window.location.reload();
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
          onClick={() => setActiveTab('reviews')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'reviews' ? 'bg-white shadow-sm' : 'text-gray-600'
          }`}
        >
          <Star className="h-4 w-4 inline mr-2" />
          Reviews ({reviews.length})
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
        <button
          onClick={() => setActiveTab('responses')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
            activeTab === 'responses' ? 'bg-white shadow-sm' : 'text-gray-600'
          }`}
        >
          <MessageSquare className="h-4 w-4 inline mr-2" />
          Responses ({questionResponses.length})
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
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Question Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-full border rounded-md px-3 py-2"
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
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption(index)}
                      disabled={options.length === 1}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption}>
                  Add Option
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={addQuestion}>Add Question</Button>
              <Button variant="outline" onClick={() => setShowAddQuestion(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Reviews Yet</h3>
                <p className="text-gray-600">Customer reviews will appear here once they start leaving feedback.</p>
              </CardContent>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={n <= review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                          ★
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleString()}
                    </div>
                  </div>
                  {review.comment && (
                    <div className="text-sm text-gray-700">{review.comment}</div>
                  )}
                  <div className="mt-2">
                    <Badge variant="outline">Table {review.orders.table_number}</Badge>
                  </div>
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

      {/* Responses Tab */}
      {activeTab === 'responses' && (
        <div className="space-y-3">
          {questionResponses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Responses Yet</h3>
                <p className="text-gray-600">Customer responses to your custom questions will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            questionResponses.map((response) => (
              <Card key={response.id}>
                <CardContent className="p-4">
                  <div className="mb-2">
                    <h3 className="font-medium text-gray-900">
                      {response.feedback_questions.question}
                    </h3>
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
                  <div className="text-xs text-muted-foreground">
                    {new Date(response.created_at).toLocaleString()}
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
