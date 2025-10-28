"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Users,
  Smartphone,
  LayoutDashboard,
  ChevronRight,
  Sparkles,
  Bot,
} from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import Link from "next/link";
import Image from "next/image";

export default function DemoPage() {
  const [activeView, setActiveView] = useState<"customer" | "owner">("customer");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <NavigationBreadcrumb showBackButton={false} isDemo={true} />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Experience Servio in Action</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how Servio transforms the dining experience from both sides - your customers' mobile
            ordering and your powerful dashboard.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            <button
              onClick={() => setActiveView("customer")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeView === "customer"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Smartphone className="w-4 h-4 inline mr-2" />
              Customer View
            </button>
            <button
              onClick={() => setActiveView("owner")}
              className={`px-6 py-3 rounded-md font-medium transition-all ${
                activeView === "owner"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 inline mr-2" />
              Owner Dashboard
            </button>
          </div>
        </div>

        {/* AI Assistant Preview - Shown on both views */}
        <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center">
                  <Bot className="w-6 h-6 mr-2 text-purple-600" />
                  AI Assistant
                  <Sparkles className="w-5 h-5 ml-2 text-yellow-500" />
                </CardTitle>
                <CardDescription className="text-base mt-2">
                  Your intelligent business partner - available on Premium plan
                </CardDescription>
              </div>
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                Premium
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-lg">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full p-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-1">AI Assistant:</p>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <p className="text-sm text-gray-800">
                        "Based on today's sales, your Cappuccino and Avocado Toast are trending 40%
                        above average. I recommend featuring them as specials tomorrow. Would you
                        like me to create a promotional post?"
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-gray-100 rounded-full p-2">
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-1">You:</p>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-800">
                        "What were my busiest hours yesterday?"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="bg-white p-3 rounded border">
                <p className="font-semibold text-purple-600">💡 Smart Insights</p>
                <p className="text-gray-600">Sales patterns & recommendations</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="font-semibold text-purple-600">📊 Data Analysis</p>
                <p className="text-gray-600">Automatic trend detection</p>
              </div>
              <div className="bg-white p-3 rounded border">
                <p className="font-semibold text-purple-600">🎯 Action Items</p>
                <p className="text-gray-600">Personalized suggestions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer View */}
        {activeView === "customer" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      <Smartphone className="w-6 h-6 mr-2 text-purple-600" />
                      Customer Experience
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      See what your customers see when they scan a QR code
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-500">Live Demo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Screenshot placeholder */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-8 border-2 border-purple-200">
                  <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">
                    <div className="p-6 space-y-4">
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-gray-900">Demo Cafe</h3>
                        <p className="text-gray-600">Table 1</p>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900">Cappuccino</h4>
                          <p className="text-sm text-gray-600">Rich espresso with steamed milk</p>
                          <p className="text-lg font-bold text-purple-600">£3.50</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900">Latte</h4>
                          <p className="text-sm text-gray-600">Smooth espresso with steamed milk</p>
                          <p className="text-lg font-bold text-purple-600">£3.75</p>
                        </div>
                      </div>
                      <Button className="w-full bg-purple-600 hover:bg-purple-700">
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-2">📱 Mobile-First</h4>
                    <p className="text-sm text-gray-600">Optimized for smartphones</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-2">💳 Instant Payment</h4>
                    <p className="text-sm text-gray-600">Pay directly from phone</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-2">🎯 Easy Navigation</h4>
                    <p className="text-sm text-gray-600">Browse by category</p>
                  </div>
                </div>

                {/* Try Live Demo */}
                <Link href="/order?venue=demo-cafe&table=1&demo=true" target="_blank">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700 h-14 text-lg">
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Try Live Customer Demo
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Owner View */}
        {activeView === "owner" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      <LayoutDashboard className="w-6 h-6 mr-2 text-purple-600" />
                      Owner Dashboard
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      Powerful tools to manage your entire operation
                    </CardDescription>
                  </div>
                  <Badge className="bg-purple-500">Full Access</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dashboard Screenshot placeholder */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-8 border-2 border-purple-200">
                  <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
                    <div className="bg-purple-600 text-white p-4">
                      <h3 className="text-xl font-bold">Dashboard Overview</h3>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg text-center">
                          <p className="text-3xl font-bold text-blue-600">12</p>
                          <p className="text-sm text-gray-600">Live Orders</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg text-center">
                          <p className="text-3xl font-bold text-green-600">£847</p>
                          <p className="text-sm text-gray-600">Today's Revenue</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg text-center">
                          <p className="text-3xl font-bold text-purple-600">47</p>
                          <p className="text-sm text-gray-600">Total Orders</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Features */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-purple-300 transition-colors">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <ChevronRight className="w-5 h-5 mr-2 text-purple-600" />
                      Live Order Tracking
                    </h4>
                    <p className="text-sm text-gray-600">
                      See orders in real-time as customers place them. Update status instantly.
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-purple-300 transition-colors">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <ChevronRight className="w-5 h-5 mr-2 text-purple-600" />
                      Kitchen Display System
                    </h4>
                    <p className="text-sm text-gray-600">
                      Digital KDS showing what needs to be prepared, organized by station.
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-purple-300 transition-colors">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <ChevronRight className="w-5 h-5 mr-2 text-purple-600" />
                      Menu Management
                    </h4>
                    <p className="text-sm text-gray-600">
                      Upload PDFs or scrape from your website. AI extracts items automatically.
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-gray-200 hover:border-purple-300 transition-colors">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <ChevronRight className="w-5 h-5 mr-2 text-purple-600" />
                      Analytics & Insights
                    </h4>
                    <p className="text-sm text-gray-600">
                      Track sales, popular items, peak hours, and customer feedback.
                    </p>
                  </div>
                </div>

                {/* Sign Up CTA */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-6 text-center">
                  <h3 className="text-2xl font-bold mb-2">Ready to Transform Your Business?</h3>
                  <p className="mb-4 text-purple-100">
                    Start your 14-day free trial. No credit card required.
                  </p>
                  <Link href="/sign-up">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="bg-white text-purple-600 hover:bg-gray-100"
                    >
                      <Users className="w-5 h-5 mr-2" />
                      Start Free Trial
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
