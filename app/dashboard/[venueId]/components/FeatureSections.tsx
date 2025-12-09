"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  ChefHat,
  Table,
  ShoppingBag,
  Users,
  Package,
  BarChart,
  MessageSquare,
  Settings,
  QrCode,
  Receipt,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface Feature {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

interface FeatureSection {
  title: string;
  description: string;
  features: Feature[];
}

interface FeatureSectionsProps {
  venueId: string;
  userRole?: string;
}

export function FeatureSections({ venueId, userRole }: FeatureSectionsProps) {
  // Track role changes
  useEffect(() => {}, [userRole]);

  const handleFeatureClick = (_feature: Feature, _section: string) => {
    // Feature click logging removed for cleaner logs
  };

  const sections: FeatureSection[] = [
    {
      title: "Operations",
      description: "Core day-to-day operations",
      features: [
        {
          title: "Live Orders",
          description: "Monitor and manage incoming orders in real-time",
          href: `/dashboard/${venueId}/live-orders`,
          icon: Clock,
          color: "text-blue-600",
          bgColor: "bg-blue-100",
        },
        {
          title: "Kitchen Display",
          description: "View and manage orders in the kitchen",
          href: `/dashboard/${venueId}/kds`,
          icon: ChefHat,
          color: "text-red-600",
          bgColor: "bg-red-100",
        },
        {
          title: "Table Management",
          description: "Manage tables, reservations, and seating",
          href: `/dashboard/${venueId}/tables`,
          icon: Table,
          color: "text-purple-600",
          bgColor: "bg-purple-100",
        },
        {
          title: "Payments",
          description: "Manage payments (pay-at-till orders) and view receipts for all completed orders",
          href: `/dashboard/${venueId}/payments`,
          icon: Receipt,
          color: "text-emerald-600",
          bgColor: "bg-emerald-100",
        },
      ],
    },
    {
      title: "Management",
      description: "Configure and manage your venue",
      features: [
        {
          title: "Menu Builder",
          description: "Create and edit your menu items",
          href: `/dashboard/${venueId}/menu-management`,
          icon: ShoppingBag,
          color: "text-orange-600",
          bgColor: "bg-orange-100",
        },
        {
          title: "Staff Management",
          description: "Manage staff roles and permissions",
          href: `/dashboard/${venueId}/staff`,
          icon: Users,
          color: "text-green-600",
          bgColor: "bg-green-100",
        },
        {
          title: "Inventory",
          description: "Track and manage inventory levels",
          href: `/dashboard/${venueId}/inventory`,
          icon: Package,
          color: "text-yellow-600",
          bgColor: "bg-yellow-100",
        },
        {
          title: "QR Codes",
          description: "Generate and manage QR codes for tables",
          href: `/dashboard/${venueId}/qr-codes`,
          icon: QrCode,
          color: "text-green-600",
          bgColor: "bg-green-100",
        },
      ],
    },
  ];

  // Add Insights section for owners/managers (fail open if role unknown so users still see features)
  const isPrivileged = userRole === "owner" || userRole === "manager" || !userRole;

  if (isPrivileged) {
    sections.push({
      title: "Insights",
      description: "Analytics and customer feedback",
      features: [
        {
          title: "Analytics",
          description: "View detailed analytics and reports",
          href: `/dashboard/${venueId}/analytics`,
          icon: BarChart,
          color: "text-indigo-600",
          bgColor: "bg-indigo-100",
        },
        {
          title: "Feedback",
          description: "View and respond to customer feedback",
          href: `/dashboard/${venueId}/feedback`,
          icon: MessageSquare,
          color: "text-pink-600",
          bgColor: "bg-pink-100",
        },
        {
          title: "Settings",
          description: "Configure venue settings and preferences",
          href: `/dashboard/${venueId}/settings`,
          icon: Settings,
          color: "text-gray-600",
          bgColor: "bg-gray-100",
        },
      ],
    });
  } else {
    // Staff role - sections configured above
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">All Features</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Access all platform features from one place
        </p>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{section.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">{section.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.features.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                onClick={() => handleFeatureClick(feature, section.title)}
                className="block h-full"
              >
                <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-gray-300 dark:hover:border-purple-500 h-full flex flex-col bg-white dark:bg-gray-800 dark:border-gray-700">
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <div
                      className={`${feature.bgColor} dark:bg-opacity-20 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <feature.icon className={`h-6 w-6 ${feature.color} dark:brightness-150`} />
                    </div>
                    <h4 className="text-base font-semibold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-purple-400 transition-colors">
                      {feature.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed flex-1">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
