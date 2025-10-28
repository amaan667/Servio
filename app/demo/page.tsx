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
  ShoppingCart,
  Sparkles,
  Bot,
  TrendingUp,
  Package,
  Clock,
  Star,
  Plus,
} from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import Link from "next/link";
import Image from "next/image";
import { demoMenuItems } from "@/data/demoMenuItems";

export default function DemoPage() {
  const [activeView, setActiveView] = useState<"customer" | "owner">("customer");

  // Select variety of items from different categories
  const showcaseItems = [
    demoMenuItems[0], // Cappuccino (Coffee)
    demoMenuItems[10], // Croissant (Pastries)
    demoMenuItems[14], // Avocado Toast (Pastries)
    demoMenuItems[15], // Club Sandwich (Food)
    demoMenuItems[20], // Chocolate Cake (Desserts)
    demoMenuItems[6], // Fresh Orange Juice (Cold Drinks)
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <NavigationBreadcrumb showBackButton={false} isDemo={true} />

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Experience Servio in Action</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See how Servio transforms the dining experience - customer ordering and owner dashboard
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1 shadow-sm">
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

        {/* Customer View */}
        {activeView === "customer" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      <Smartphone className="w-6 h-6 mr-2 text-purple-600" />
                      Mobile Ordering Experience
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      Beautiful, intuitive ordering from any smartphone
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-500">Live Demo</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mobile Phone Mockup */}
                <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-8">
                  <div className="max-w-sm mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden border-8 border-gray-800">
                    {/* Phone Screen */}
                    <div className="bg-white">
                      {/* Header */}
                      <div className="bg-purple-600 text-white p-4 text-center">
                        <h3 className="text-xl font-bold">Demo Cafe</h3>
                        <p className="text-sm text-purple-100">Table 1 • Scan to Order</p>
                      </div>

                      {/* Menu Items Grid */}
                      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                        {showcaseItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex gap-3 bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                          >
                            <Image
                              src={item.image || "/placeholder-logo.png"}
                              alt={item.name}
                              width={80}
                              height={80}
                              className="rounded-lg object-cover flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 text-sm">{item.name}</h4>
                              <p className="text-xs text-gray-600 line-clamp-2">
                                {item.description}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-base font-bold text-purple-600">
                                  £{item.price.toFixed(2)}
                                </p>
                                <Button
                                  size="sm"
                                  className="bg-purple-600 hover:bg-purple-700 h-7 px-3"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cart Footer */}
                      <div className="border-t p-4 bg-white sticky bottom-0">
                        <Button className="w-full bg-purple-600 hover:bg-purple-700">
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          View Cart (3 items)
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2">📱 Mobile-Optimized</h4>
                    <p className="text-sm text-gray-600">Works perfectly on all smartphones</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2">🖼️ Rich Media</h4>
                    <p className="text-sm text-gray-600">Beautiful images for every item</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2">⚡ Instant Checkout</h4>
                    <p className="text-sm text-gray-600">Stripe-powered secure payments</p>
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
            {/* Dashboard Preview */}
            <Card className="border-2 border-purple-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      <LayoutDashboard className="w-6 h-6 mr-2 text-purple-600" />
                      Owner Dashboard
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      Powerful command center for your business
                    </CardDescription>
                  </div>
                  <Badge className="bg-purple-500">Full Control</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Dashboard Stats Mockup */}
                <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-xl p-6 border-2 border-purple-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <Badge variant="outline" className="text-xs">
                          Live
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">8</p>
                      <p className="text-sm text-gray-600">Active Orders</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <Badge variant="outline" className="text-xs">
                          +12%
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">£1,247</p>
                      <p className="text-sm text-gray-600">Today's Revenue</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <ShoppingCart className="w-5 h-5 text-purple-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">34</p>
                      <p className="text-sm text-gray-600">Completed Orders</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <Star className="w-5 h-5 text-yellow-600" />
                      </div>
                      <p className="text-2xl font-bold text-gray-900">4.8</p>
                      <p className="text-sm text-gray-600">Avg Rating</p>
                    </div>
                  </div>

                  {/* Recent Orders Preview */}
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="bg-purple-600 text-white px-4 py-2 font-semibold">
                      Live Orders
                    </div>
                    <div className="divide-y">
                      <div className="p-3 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">Table 5</p>
                            <p className="text-sm text-gray-600">2x Cappuccino, 1x Croissant</p>
                          </div>
                          <Badge className="bg-blue-500">Preparing</Badge>
                        </div>
                      </div>
                      <div className="p-3 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">Table 3</p>
                            <p className="text-sm text-gray-600">1x Caesar Salad, 1x Latte</p>
                          </div>
                          <Badge className="bg-orange-500">New</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key Features Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white p-5 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-purple-600" />
                      Real-Time Order Management
                    </h4>
                    <p className="text-sm text-gray-600">
                      Track every order from placement to completion with live status updates
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Package className="w-5 h-5 mr-2 text-purple-600" />
                      Kitchen Display System
                    </h4>
                    <p className="text-sm text-gray-600">
                      Digital KDS showing tickets organized by station and priority
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
                      Advanced Analytics
                    </h4>
                    <p className="text-sm text-gray-600">
                      Sales trends, popular items, peak hours, and customer insights
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-lg border-2 border-purple-100">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <Users className="w-5 h-5 mr-2 text-purple-600" />
                      Staff Management
                    </h4>
                    <p className="text-sm text-gray-600">
                      Role-based access for waiters, kitchen staff, and managers
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Assistant Preview */}
            <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center">
                      <Bot className="w-6 h-6 mr-2 text-purple-600" />
                      AI Assistant
                      <Sparkles className="w-5 h-5 ml-2 text-yellow-500" />
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      Your intelligent business partner - Premium feature
                    </CardDescription>
                  </div>
                  <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                    Premium Only
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="space-y-4">
                    {/* AI Message */}
                    <div className="flex items-start gap-3">
                      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-full p-2">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-500 mb-1">AI Assistant</p>
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <p className="text-sm text-gray-800 leading-relaxed">
                            📊 <strong>Sales Insight:</strong> Your Cappuccino and Avocado Toast are
                            trending 40% above average today.
                            <br />
                            <br />
                            💡 <strong>Recommendation:</strong> Consider featuring them as specials
                            tomorrow to maximize revenue.
                            <br />
                            <br />
                            🎯 <strong>Action:</strong> Would you like me to create promotional
                            materials or adjust pricing?
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* User Question */}
                    <div className="flex items-start gap-3 justify-end">
                      <div className="flex-1 text-right">
                        <p className="text-xs font-semibold text-gray-500 mb-1">You</p>
                        <div className="bg-gray-100 rounded-lg p-3 inline-block text-left">
                          <p className="text-sm text-gray-800">
                            What were my busiest hours yesterday?
                          </p>
                        </div>
                      </div>
                      <div className="bg-gray-300 rounded-full p-2">
                        <Users className="w-5 h-5 text-gray-700" />
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex items-start gap-3">
                      <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-full p-2">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-500 mb-1">AI Assistant</p>
                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <p className="text-sm text-gray-800 leading-relaxed">
                            Your peak hours yesterday were <strong>12:00-14:00</strong> (lunch) with
                            23 orders and <strong>18:00-20:00</strong> (dinner) with 31 orders.
                            <br />
                            <br />
                            💰 Revenue was highest during dinner service at £847. Consider staffing
                            accordingly.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Capabilities */}
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="bg-white p-3 rounded-lg border border-purple-200">
                    <p className="font-semibold text-purple-600 mb-1">💡 Smart Insights</p>
                    <p className="text-gray-600">Sales patterns & trends</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-purple-200">
                    <p className="font-semibold text-purple-600 mb-1">📊 Data Analysis</p>
                    <p className="text-gray-600">Automatic reporting</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-purple-200">
                    <p className="font-semibold text-purple-600 mb-1">🎯 Recommendations</p>
                    <p className="text-gray-600">Actionable suggestions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sign Up CTA */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl p-8 text-center">
              <h3 className="text-3xl font-bold mb-3">Ready to Transform Your Business?</h3>
              <p className="text-lg mb-6 text-purple-100">
                Start your 14-day free trial. No credit card required.
              </p>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  variant="secondary"
                  className="bg-white text-purple-600 hover:bg-gray-100 h-12 px-8"
                >
                  <Users className="w-5 h-5 mr-2" />
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
