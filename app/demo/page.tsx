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
  Clock,
  Star,
  Plus,
  ShoppingBag,
  Table,
} from "lucide-react";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import Link from "next/link";
import Image from "next/image";
import { demoMenuItems } from "@/data/demoMenuItems";

export default function DemoPage() {
  const [activeView, setActiveView] = useState<"customer" | "owner">("customer");

  // Select variety of items from different categories - 18 items showcasing all business types
  const showcaseItems = [
    // Coffee (5 items)
    demoMenuItems[0], // Cappuccino
    demoMenuItems[1], // Latte
    demoMenuItems[2], // Americano
    demoMenuItems[3], // Mocha
    demoMenuItems[4], // Flat White
    // Pastries (3 items)
    demoMenuItems[10], // Croissant
    demoMenuItems[11], // Pain au Chocolat
    demoMenuItems[14], // Avocado Toast
    // Food (5 items)
    demoMenuItems[15], // Club Sandwich
    demoMenuItems[16], // Caesar Salad
    demoMenuItems[17], // Quiche Lorraine
    demoMenuItems[18], // Chicken Panini
    demoMenuItems[19], // Soup of the Day
    // Cold Drinks (2 items)
    demoMenuItems[6], // Fresh Orange Juice
    demoMenuItems[7], // Sparkling Water
    // Desserts (3 items)
    demoMenuItems[20], // Chocolate Cake
    demoMenuItems[21], // Tiramisu
    demoMenuItems[22], // Cheesecake
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
          <div className="inline-flex gap-2">
            <button
              onClick={() => setActiveView("customer")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeView === "customer"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:text-gray-900 border border-gray-300"
              }`}
            >
              <Smartphone className="w-4 h-4 inline mr-2" />
              Customer View
            </button>
            <button
              onClick={() => setActiveView("owner")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                activeView === "owner"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:text-gray-900 border border-gray-300"
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
                                <Button size="sm" variant="servio" className="h-7 px-3">
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cart Footer */}
                      <div className="border-t p-4 bg-white sticky bottom-0">
                        <Button variant="servio" className="w-full">
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
                <Link
                  href="/order?venue=demo-cafe&table=1&demo=1&skipGroupSize=true"
                  target="_blank"
                >
                  <Button variant="servio" className="w-full h-14 text-lg">
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
                {/* Trial Banner */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5" />
                      <span className="font-semibold">14-day free trial • 12 days remaining</span>
                    </div>
                    <Button size="sm" variant="servio">
                      Upgrade
                    </Button>
                  </div>
                </div>

                {/* Quick Actions Toolbar */}
                <Card className="bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <div className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-gray-600" />
                        Live Orders
                      </div>
                      <div className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 flex items-center">
                        <LayoutDashboard className="w-4 h-4 mr-2 text-gray-600" />
                        KDS
                      </div>
                      <div className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 flex items-center">
                        <ShoppingCart className="w-4 h-4 mr-2 text-gray-600" />
                        Menu
                      </div>
                      <div className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2 text-gray-600" />
                        Analytics
                      </div>
                      <div className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 flex items-center">
                        <Users className="w-4 h-4 mr-2 text-gray-600" />
                        Staff
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* KPI Cards - Matches Real Dashboard */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Clock className="w-6 h-6 text-blue-600" />
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600"
                        >
                          +18%
                        </Badge>
                      </div>
                      <p className="text-3xl font-bold text-gray-900 mb-1">47</p>
                      <p className="text-sm text-gray-600 mb-2">Today's Orders</p>
                      <p className="text-xs text-gray-500">vs yesterday</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600"
                        >
                          +24%
                        </Badge>
                      </div>
                      <p className="text-3xl font-bold text-gray-900 mb-1">£1,847</p>
                      <p className="text-sm text-gray-600 mb-2">Revenue</p>
                      <p className="text-xs text-gray-500">vs yesterday</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Table className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900 mb-1">15</p>
                      <p className="text-sm text-gray-600 mb-2">Tables Set Up</p>
                      <p className="text-xs text-gray-500">all active</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                          <ShoppingBag className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                      <p className="text-3xl font-bold text-gray-900 mb-1">127</p>
                      <p className="text-sm text-gray-600 mb-2">Menu Items</p>
                      <p className="text-xs text-gray-500">available</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Live Orders Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-600" />
                      Live Orders
                      <Badge className="ml-2 bg-blue-500">8 Active</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        {
                          table: "Table 5",
                          items: "2x Cappuccino, 1x Croissant",
                          time: "2 min ago",
                          status: "Preparing",
                          color: "bg-blue-500",
                        },
                        {
                          table: "Table 3",
                          items: "1x Caesar Salad, 1x Latte",
                          time: "5 min ago",
                          status: "New",
                          color: "bg-orange-500",
                        },
                        {
                          table: "Table 8",
                          items: "1x Club Sandwich, 1x Smoothie Bowl",
                          time: "8 min ago",
                          status: "Ready",
                          color: "bg-green-500",
                        },
                        {
                          table: "Table 12",
                          items: "2x Avocado Toast, 2x Orange Juice",
                          time: "just now",
                          status: "New",
                          color: "bg-orange-500",
                        },
                        {
                          table: "Table 2",
                          items: "1x Tiramisu, 1x Cappuccino",
                          time: "12 min ago",
                          status: "Serving",
                          color: "bg-purple-500",
                        },
                      ].map((order, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold text-gray-900">{order.table}</p>
                              <span className="text-xs text-gray-500">{order.time}</span>
                            </div>
                            <p className="text-sm text-gray-600">{order.items}</p>
                          </div>
                          <Badge className={order.color}>{order.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Top Selling Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Star className="w-5 h-5 mr-2 text-yellow-600" />
                      Top Selling Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { name: "Cappuccino", sales: 23, revenue: "£80.50" },
                        { name: "Avocado Toast", sales: 18, revenue: "£117.00" },
                        { name: "Latte", sales: 15, revenue: "£60.00" },
                        { name: "Club Sandwich", sales: 14, revenue: "£119.00" },
                        { name: "Croissant", sales: 12, revenue: "£30.00" },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-purple-600">#{idx + 1}</span>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.sales} sold</p>
                            </div>
                          </div>
                          <p className="font-bold text-green-600">{item.revenue}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
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
                  <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-sm">
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
                <Button size="lg" variant="servio" className="h-12 px-8">
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
