'use client';

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, CheckCircle, AlertCircle } from 'lucide-react';

const examplePrompts = [
  "Rename all Coffee items to include '12oz'",
  "Increase pastry prices by 10%",
  "Hide items with no orders this week",
  "Add 'Vegan' label to plant-based items",
  "Create a happy hour discount for Cold Drinks",
];

const demoResponses: { [key: string]: any } = {
  "Rename all Coffee items to include '12oz'": {
    success: true,
    changes: 5,
    preview: [
      { old: 'Cappuccino', new: 'Cappuccino 12oz' },
      { old: 'Latte', new: 'Latte 12oz' },
      { old: 'Americano', new: 'Americano 12oz' },
      { old: 'Mocha', new: 'Mocha 12oz' },
      { old: 'Flat White', new: 'Flat White 12oz' },
    ],
    message: "Servio would rename 5 coffee items to include size information"
  },
  "Increase pastry prices by 10%": {
    success: true,
    changes: 5,
    preview: [
      { item: 'Avocado Toast', old: '£6.50', new: '£7.15' },
      { item: 'Croissant', old: '£2.50', new: '£2.75' },
      { item: 'Pain au Chocolat', old: '£3.25', new: '£3.58' },
      { item: 'Blueberry Muffin', old: '£3.00', new: '£3.30' },
      { item: 'Cinnamon Roll', old: '£4.50', new: '£4.95' },
    ],
    message: "Servio would adjust 5 pastry items with a 10% price increase"
  },
  "Increase brunch prices by 10%": {
    success: true,
    changes: 5,
    preview: [
      { item: 'Avocado Toast', old: '£6.50', new: '£7.15' },
      { item: 'Croissant', old: '£2.50', new: '£2.75' },
      { item: 'Pain au Chocolat', old: '£3.25', new: '£3.58' },
      { item: 'Blueberry Muffin', old: '£3.00', new: '£3.30' },
      { item: 'Cinnamon Roll', old: '£4.50', new: '£4.95' },
    ],
    message: "Servio would adjust 5 pastry items with a 10% price increase"
  },
  "Hide items with no orders this week": {
    success: true,
    changes: 3,
    preview: [
      { item: 'Green Tea', status: 'Hidden' },
      { item: 'Soup of the Day', status: 'Hidden' },
      { item: 'Apple Pie', status: 'Hidden' },
    ],
    message: "Servio would hide 3 items that haven't been ordered this week"
  },
  "Add 'Vegan' label to plant-based items": {
    success: true,
    changes: 4,
    preview: [
      { item: 'Avocado Toast', label: '🌱 Vegan' },
      { item: 'Smoothie Bowl', label: '🌱 Vegan' },
      { item: 'Fresh Orange Juice', label: '🌱 Vegan' },
      { item: 'Green Tea', label: '🌱 Vegan' },
    ],
    message: "Servio would add vegan labels to 4 plant-based items"
  },
  "Create a happy hour discount for Cold Drinks": {
    success: true,
    changes: 1,
    preview: [
      { 
        promotion: 'Happy Hour: Cold Drinks', 
        discount: '20% off',
        time: '3pm - 5pm',
        items: '5 items affected'
      },
    ],
    message: "Servio would create a happy hour promotion for 5 cold drink items"
  },
};

export default function DemoAISection() {
  console.log('[DEMO DEBUG] DemoAISection component rendering', {
    timestamp: new Date().toISOString(),
  });

  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRunPreview = (prompt: string) => {
    setIsProcessing(true);
    setResponse(null);
    
    // Simulate processing delay
    setTimeout(() => {
      const result = demoResponses[prompt] || {
        success: false,
        message: "This is a demo — try one of the suggested prompts above to see how Servio AI works!"
      };
      setResponse(result);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <Card className="border-2 border-purple-300 bg-gradient-to-br from-white to-purple-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center">
              <Sparkles className="w-6 h-6 mr-2 text-purple-600" />
              Servio AI Assistant
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Ask Servio to help you manage your menu with natural language
            </CardDescription>
          </div>
          <Badge className="bg-gradient-to-r from-purple-600 to-purple-800 text-white border-0 px-4 py-2">
            🤖 AI Demo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>💡 How it works:</strong> Simply describe what you want to change, and Servio AI 
            will understand your request, preview the changes, and apply them to your menu — no manual editing required.
          </p>
        </div>

        {/* Example Prompts */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Try these examples:</h4>
          <div className="flex flex-wrap gap-2">
            {examplePrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedPrompt(prompt);
                  setCustomPrompt(prompt);
                }}
                className={`${
                  selectedPrompt === prompt
                    ? 'bg-purple-100 border-purple-400 text-purple-900'
                    : 'bg-white border-gray-300'
                }`}
              >
                {prompt}
              </Button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="💬 Ask Servio to update your menu..."
              className="flex-1 px-4 py-3 border-2 border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-gray-900"
            />
            <Button
              onClick={() => handleRunPreview(customPrompt)}
              disabled={!customPrompt || isProcessing}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-3 whitespace-nowrap min-w-fit"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  <span>Run Preview</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Response Area */}
        {response && (
          <div className={`border-2 rounded-lg p-6 ${
            response.success 
              ? 'border-green-300 bg-green-50' 
              : 'border-yellow-300 bg-yellow-50'
          }`}>
            <div className="flex items-start space-x-3 mb-4">
              {response.success ? (
                <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
              ) : (
                <AlertCircle className="w-6 h-6 text-yellow-600 mt-1" />
              )}
              <div className="flex-1">
                <h4 className={`font-bold text-lg ${
                  response.success ? 'text-green-900' : 'text-yellow-900'
                }`}>
                  {response.success ? 'Preview Ready' : 'Demo Note'}
                </h4>
                <p className={`text-sm mt-1 ${
                  response.success ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {response.message}
                </p>
              </div>
            </div>

            {/* Preview Changes */}
            {response.success && response.preview && (
              <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                  <h5 className="font-semibold text-gray-900">Preview Changes:</h5>
                </div>
                <div className="divide-y divide-gray-200">
                  {response.preview.map((change: any, index: number) => (
                    <div key={index} className="px-4 py-3 hover:bg-gray-50">
                      {change.old && change.new ? (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 line-through">{change.old}</span>
                          <span className="text-purple-600 font-medium">→ {change.new}</span>
                        </div>
                      ) : change.item && change.old && change.new ? (
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{change.item}</div>
                          <div className="flex items-center space-x-2 text-sm">
                            <span className="text-gray-600 line-through">{change.old}</span>
                            <span className="text-purple-600 font-medium">→ {change.new}</span>
                          </div>
                        </div>
                      ) : change.item && change.status ? (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">{change.item}</span>
                          <Badge variant="outline" className="border-orange-300 text-orange-700">
                            {change.status}
                          </Badge>
                        </div>
                      ) : change.item && change.label ? (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-900">{change.item}</span>
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            {change.label}
                          </Badge>
                        </div>
                      ) : change.promotion ? (
                        <div className="space-y-2">
                          <div className="font-semibold text-purple-900">{change.promotion}</div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">Discount: </span>
                              <span className="font-medium">{change.discount}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Time: </span>
                              <span className="font-medium">{change.time}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">{change.items}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons (Demo Only) */}
            {response.success && (
              <div className="mt-6 flex gap-3">
                <Button className="bg-purple-600 hover:bg-purple-700" disabled>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Apply Changes (Demo Only)
                </Button>
                <Button variant="outline" onClick={() => setResponse(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Footer Note */}
        <div className="bg-purple-100 border border-purple-300 rounded-lg p-4 mt-6">
          <p className="text-sm text-purple-900">
            <strong>🎯 In the real system:</strong> These AI-powered changes would be applied directly 
            to your menu with a single click. This demo shows preview-only functionality to demonstrate 
            how Servio AI understands natural language and makes intelligent menu updates.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}