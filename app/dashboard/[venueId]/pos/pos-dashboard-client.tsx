"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  Receipt,
  Clock,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { TableManagementEntity } from "@/components/pos/TableManagementEntity";
import { LiveOrdersPOS } from "@/components/pos/LiveOrdersPOS";

interface POSDashboardClientProps {
  venueId: string;
}

export default function POSDashboardClient({ venueId }: POSDashboardClientProps) {
  const [activeTab, setActiveTab] = useState("tables");

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Table className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Active Tables</p>
                <p className="text-2xl font-bold text-gray-900">12</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Orders in Prep</p>
                <p className="text-2xl font-bold text-gray-900">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CreditCard className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Unpaid Orders</p>
                <p className="text-2xl font-bold text-gray-900">3</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Today's Revenue</p>
                <p className="text-2xl font-bold text-gray-900">£1,247</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main POS Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tables" className="flex items-center gap-2">
            <Table className="h-4 w-4" />
            Table Management
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Live Orders
          </TabsTrigger>
          <TabsTrigger value="counters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Counter Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Table className="h-5 w-5" />
                Table & Counter Management
              </CardTitle>
              <p className="text-sm text-gray-900">
                Manage seating, tabs, and payments at the entity level
              </p>
            </CardHeader>
            <CardContent>
              <TableManagementEntity venueId={venueId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Live Orders - Kitchen Display System
              </CardTitle>
              <p className="text-sm text-gray-900">
                Manage order preparation, status updates, and kitchen workflow
              </p>
            </CardHeader>
            <CardContent>
              <LiveOrdersPOS venueId={venueId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Counter Orders
              </CardTitle>
              <p className="text-sm text-gray-900">
                Fast-moving counter service orders and pickup management
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Counter Orders</h3>
                <p className="text-gray-900 mb-4">
                  Counter orders are displayed in the Live Orders tab with proper filtering.
                </p>
                <Button onClick={() => setActiveTab("orders")}>View Live Orders</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Alerts and Notifications */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <div>
              <h4 className="font-medium text-orange-900">System Alerts</h4>
              <p className="text-sm text-orange-700">
                Table 5 has been waiting 25 minutes • 3 orders need payment • Kitchen is 15 minutes
                behind
              </p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto">
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
