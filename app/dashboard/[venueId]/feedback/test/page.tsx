"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function FeedbackTestPage({ params }: { params: Promise<{ venueId: string }> }) {
  const [testResult, setTestResult] = useState<string>('Testing...');
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [canInsert, setCanInsert] = useState<boolean | null>(null);
  const [canSelect, setCanSelect] = useState<boolean | null>(null);
  const [venueId, setVenueId] = useState<string>('');

  useEffect(() => {
    params.then(({ venueId }) => {
      setVenueId(venueId);
      testFeedbackSystem(venueId);
    });
  }, []);

  const testFeedbackSystem = async (venueId: string) => {
    try {
      const supabase = createClient();
      if (!supabase) {
        setTestResult('❌ Supabase client not available');
        return;
      }

      setTestResult('🔍 Testing feedback system...');

      // Test 1: Check if table exists
      try {
        const { data, error } = await supabase
          .from('feedback')
          .select('id')
          .limit(1);

        if (error) {
          if (error.code === '42P01') { // Table doesn't exist
            setTableExists(false);
            setTestResult('❌ Feedback table does not exist. Please run the database script.');
            return;
          } else {
            setTableExists(false);
            setTestResult(`❌ Error accessing feedback table: ${error.message}`);
            return;
          }
        } else {
          setTableExists(true);
          setTestResult('✅ Feedback table exists');
        }
      } catch (err) {
        setTableExists(false);
        setTestResult(`❌ Exception accessing feedback table: ${err}`);
        return;
      }

      // Test 2: Test insert permission
      try {
        const testFeedback = {
          venue_id: venueId,
          customer_name: 'Test Customer',
          rating: 5,
          comment: 'Test feedback for system verification',
          category: 'Test',
          sentiment_label: 'positive',
          sentiment_score: 0.9
        };

        const { error: insertError } = await supabase
          .from('feedback')
          .insert(testFeedback);

        if (insertError) {
          setCanInsert(false);
          setTestResult(`❌ Cannot insert feedback: ${insertError.message}`);
          return;
        } else {
          setCanInsert(true);
          setTestResult('✅ Can insert feedback');
        }
      } catch (err) {
        setCanInsert(false);
        setTestResult(`❌ Exception inserting feedback: ${err}`);
        return;
      }

      // Test 3: Test select permission
      try {
        const { data, error: selectError } = await supabase
          .from('feedback')
          .select('*')
          .eq('venue_id', venueId)
          .limit(5);

        if (selectError) {
          setCanSelect(false);
          setTestResult(`❌ Cannot select feedback: ${selectError.message}`);
          return;
        } else {
          setCanSelect(true);
          setTestResult('✅ All tests passed! Feedback system is working.');
        }
      } catch (err) {
        setCanSelect(false);
        setTestResult(`❌ Exception selecting feedback: ${err}`);
        return;
      }

    } catch (error) {
      setTestResult(`❌ Unexpected error: ${error}`);
    }
  };

  const insertSampleFeedback = async () => {
    try {
      const supabase = createClient();
      if (!supabase) return;

      const sampleFeedback = {
        venue_id: venueId,
        customer_name: 'John Doe',
        rating: 4,
        comment: 'Great food and service! Will definitely come back.',
        category: 'Food Quality',
        sentiment_label: 'positive',
        sentiment_score: 0.8
      };

      const { error } = await supabase
        .from('feedback')
        .insert(sampleFeedback);

      if (error) {
        alert(`Error inserting sample feedback: ${error.message}`);
      } else {
        alert('Sample feedback inserted successfully!');
        testFeedbackSystem(venueId); // Refresh the test
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Feedback System Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                This page tests if the feedback system is properly set up in your database.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Table Exists:</span>
                <span className={tableExists === true ? 'text-green-600' : tableExists === false ? 'text-red-600' : 'text-gray-500'}>
                  {tableExists === true ? '✅ Yes' : tableExists === false ? '❌ No' : 'Testing...'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium">Can Insert:</span>
                <span className={canInsert === true ? 'text-green-600' : canInsert === false ? 'text-red-600' : 'text-gray-500'}>
                  {canInsert === true ? '✅ Yes' : canInsert === false ? '❌ No' : 'Testing...'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="font-medium">Can Select:</span>
                <span className={canSelect === true ? 'text-green-600' : canSelect === false ? 'text-red-600' : 'text-gray-500'}>
                  {canSelect === true ? '✅ Yes' : canSelect === false ? '❌ No' : 'Testing...'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-100 rounded-lg">
              <p className="text-sm font-medium mb-2">Test Result:</p>
              <p className="text-sm">{testResult}</p>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => testFeedbackSystem(venueId)} variant="outline">
                Run Test Again
              </Button>
              <Button onClick={insertSampleFeedback} disabled={!tableExists}>
                Insert Sample Feedback
              </Button>
            </div>

            {tableExists === false && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">Next Steps:</h4>
                <ol className="text-sm text-red-700 space-y-1 list-decimal list-inside">
                  <li>Go to your Supabase dashboard</li>
                  <li>Navigate to SQL Editor</li>
                  <li>Copy the content from <code className="bg-red-100 px-1 rounded">scripts/feedback-schema.sql</code></li>
                  <li>Paste and run the SQL script</li>
                  <li>Refresh this page to test again</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
