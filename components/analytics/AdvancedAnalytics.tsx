/**
 * Advanced Analytics Dashboard
 * Provides AI-powered insights, predictive analytics, and business intelligence
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Minus, Brain, Target, Zap } from "lucide-react";
import { analytics } from "@/lib/analytics";

interface KPI {

}

interface Insight {

}

interface Forecasts {

}

interface BusinessIntelligence {

}

interface AdvancedAnalyticsProps {

}

export const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ venueId }) => {
  const [businessIntelligence, setBusinessIntelligence] = useState<BusinessIntelligence | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const data = await analytics.getBusinessIntelligence(venueId);
        setBusinessIntelligence(data);
      } catch (_error) {
        // Error handled silently
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [venueId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!businessIntelligence) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {businessIntelligence.kpis.map((kpi, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{kpi.name}</p>
                  <p className="text-2xl font-bold">{kpi.value.toLocaleString()}</p>
                </div>
                <div className="flex items-center space-x-1">
                  {kpi.trend === "up" && <TrendingUp className="h-4 w-4 text-green-500" />}
                  {kpi.trend === "down" && <TrendingDown className="h-4 w-4 text-red-500" />}
                  {kpi.trend === "stable" && <Minus className="h-4 w-4 text-gray-500" />}
                  <span
                    className={`text-sm font-medium ${
                      kpi.trend === "up"
                        ? "text-green-600"

                    }`}
                  >
                    {kpi.change > 0 ? "+" : ""}
                    {kpi.change}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <span>AI-Powered Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {businessIntelligence.insights.map((insight) => (
              <div
                key={insight.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold">{insight.title}</h3>
                      <Badge
                        variant={
                          insight.impact === "high"
                            ? "destructive"

                        }
                      >
                        {insight.impact} impact
                      </Badge>
                      <Badge variant="outline">
                        {Math.round(insight.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{insight.description}</p>
                    <p className="text-sm font-medium text-blue-600">{insight.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Forecasts and Recommendations */}
      <Tabs defaultValue="forecasts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="forecasts" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span>Revenue Forecast</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {businessIntelligence.forecasts.revenue.slice(0, 7).map((value, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Day {index + 1}</span>
                      <span className="font-medium">${value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-green-500" />
                  <span>Orders Forecast</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {businessIntelligence.forecasts.orders.slice(0, 7).map((value, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Day {index + 1}</span>
                      <span className="font-medium">{value} orders</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                  <span>Customer Forecast</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {businessIntelligence.forecasts.customers
                    .slice(0, 7)
                    .map((value: number, index: number) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Day {index + 1}</span>
                        <span className="font-medium">{value} customers</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {businessIntelligence.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700">{recommendation}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
