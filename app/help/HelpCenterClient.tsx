"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Mail,
  BookOpen,
  MessageSquare,
  HelpCircle,
  QrCode,
  ShoppingBag,
  BarChart,
  Users,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import NavigationBreadcrumb from "@/components/navigation-breadcrumb";
import type { LucideIcon } from "lucide-react";

interface QuickLink {
  title: string;
  href: string;
  icon: LucideIcon;
  external: boolean;
}

const faqs = [
  {
    category: "Getting Started",
    questions: [
      {
        question: "How do I create my first menu?",
        answer:
          "Go to Menu Builder in your dashboard, click 'Add Item', fill in the details (name, price, description, category), upload an image, and save. You can organize items into categories for better organization.",
      },
      {
        question: "How do I generate QR codes for my tables?",
        answer:
          "Navigate to QR Codes in your dashboard, enter a table name (e.g., 'Table 1' or 'Counter 1'), and click 'Generate QR Code'. The QR code will work immediately - no table setup required. You can print or download the QR code.",
      },
      {
        question: "How do customers place orders?",
        answer:
          "Customers scan the QR code at their table or counter, browse your menu on their phone, add items to cart, and checkout. Orders appear instantly in your Live Orders dashboard.",
      },
    ],
  },
  {
    category: "Orders & Payments",
    questions: [
      {
        question: "How do I view and manage orders?",
        answer:
          "Go to Live Orders in your dashboard. You'll see all recent orders with their status (Placed, In Prep, Ready, Serving, Completed). Click on any order to view details and update its status.",
      },
      {
        question: "How do I search for a specific order?",
        answer:
          "In the Live Orders page, use the search bar at the top. You can search by order ID, customer name, phone number, or table number. The search works across all tabs (Live, Earlier Today, History).",
      },
      {
        question: "What payment methods are supported?",
        answer:
          "Servio supports Stripe payments (card payments), demo payments for testing, and till/cash payments. Customers can pay directly through the QR code ordering system.",
      },
      {
        question: "How do I send receipts to customers?",
        answer:
          "Go to Payments in your dashboard. You can view all receipts, send them via email or SMS, and print them. Receipts are automatically generated for all completed orders.",
      },
    ],
  },
  {
    category: "Menu Management",
    questions: [
      {
        question: "How do I update menu item prices?",
        answer:
          "Go to Menu Builder, find the item you want to update, click 'Edit', change the price, and save. Changes are reflected immediately on customer-facing menus.",
      },
      {
        question: "How do I mark items as unavailable?",
        answer:
          "In Menu Builder, click on an item and toggle the 'Available' switch. Unavailable items won't appear on customer menus but remain in your system for easy re-activation.",
      },
      {
        question: "Can I import my menu from a website or PDF?",
        answer:
          "Yes! Use the AI Menu Extraction feature in Menu Builder. Upload an image or PDF of your menu, and Servio will automatically extract items, prices, and descriptions.",
      },
      {
        question: "How do I organize items into categories?",
        answer:
          "In Menu Builder, create categories first, then assign items to categories when creating or editing them. You can drag and drop items to reorder them within categories.",
      },
    ],
  },
  {
    category: "Kitchen Display System (KDS)",
    questions: [
      {
        question: "How do I set up KDS stations?",
        answer:
          "Go to Kitchen Display in your dashboard. KDS stations are automatically created (Grill, Fryer, Barista, etc.). You can customize station names and manage tickets from each station.",
      },
      {
        question: "How do orders appear in the kitchen?",
        answer:
          "When an order is placed, it automatically creates tickets for each KDS station based on the items ordered. Kitchen staff can see tickets, update status (In Progress, Ready), and mark as complete.",
      },
      {
        question: "Can I bulk update ticket statuses?",
        answer:
          "Yes, in the Kitchen Display page, you can select multiple tickets and update their statuses at once. This is useful when multiple items are ready at the same time.",
      },
    ],
  },
  {
    category: "Table Management",
    questions: [
      {
        question: "Do I need to create tables before using QR codes?",
        answer:
          "No! QR codes work immediately without table setup. However, if you want to track table status, reservations, and manage seating, you can create tables in the Table Management section.",
      },
      {
        question: "How do I manage reservations?",
        answer:
          "In Table Management, you can create reservations, assign them to tables, and track reservation status. The system shows which tables are reserved, occupied, or available.",
      },
      {
        question: "How do I clear completed table sessions?",
        answer:
          "Table sessions are automatically cleared when orders are completed. You can also manually clear sessions in Table Management or use the 'Clear Completed' option.",
      },
    ],
  },
  {
    category: "Analytics & Reports",
    questions: [
      {
        question: "What analytics are available?",
        answer:
          "View revenue trends, order counts, top-selling items, peak hours, and customer insights. Analytics are available in the Analytics section of your dashboard.",
      },
      {
        question: "Can I export data?",
        answer:
          "Yes, Enterprise tier users can export inventory data and analytics reports as CSV files. Go to the respective sections and click 'Export CSV'.",
      },
      {
        question: "How do I see today's performance?",
        answer:
          "The main dashboard shows today's key metrics: orders count, revenue, table utilization, and menu item performance. Click on any metric card to see detailed information.",
      },
    ],
  },
  {
    category: "Staff & Permissions",
    questions: [
      {
        question: "How do I invite staff members?",
        answer:
          "Go to Staff Management, click 'Invite Staff', enter their email and select a role (Manager, Server, Kitchen, Cashier). They'll receive an email invitation to join your venue.",
      },
      {
        question: "What are the different staff roles?",
        answer:
          "Owner: Full access. Manager: Can manage operations but not billing. Server: Can view orders and process payments. Kitchen: Can view KDS and update order status. Cashier: Can process payments.",
      },
      {
        question: "How do I manage staff shifts?",
        answer:
          "In Staff Management, go to the Shifts tab. You can add shifts, view schedules, and manage staff availability. Shifts help track who's working when.",
      },
    ],
  },
  {
    category: "Troubleshooting",
    questions: [
      {
        question: "Orders aren't appearing in Live Orders",
        answer:
          "Check that your internet connection is active. Refresh the page. Ensure the order status is not 'CANCELLED' or 'EXPIRED'. If issues persist, contact support.",
      },
      {
        question: "QR codes aren't working",
        answer:
          "Ensure the QR code is printed clearly and not damaged. Check that your venue is active in settings. Verify that your menu has available items. Try generating a new QR code.",
      },
      {
        question: "I can't process payments",
        answer:
          "Verify your Stripe account is connected in Settings > Billing. Check that your subscription is active. For demo payments, ensure you're in test mode.",
      },
      {
        question: "How do I reset my password?",
        answer:
          "Go to the sign-in page, click 'Forgot Password', enter your email, and check your inbox for a reset link. The link expires after 1 hour.",
      },
    ],
  },
];

// Separate component to prevent duplicate renders
function QuickLinksGrid({ links }: { links: QuickLink[] }) {
  // Force unique links - use Set to deduplicate by title
  const uniqueLinks = useMemo(() => {
    const seen = new Set<string>();
    const unique: QuickLink[] = [];
    for (const link of links) {
      if (!seen.has(link.title)) {
        seen.add(link.title);
        unique.push(link);
      }
    }

    // Duplicate links removed
    return unique;
  }, [links]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {uniqueLinks.map((link, index) => {
        const Icon = link.icon;
        const linkContent = (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardContent className="p-6 text-center">
              <Icon className="h-8 w-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900">{link.title}</h3>
            </CardContent>
          </Card>
        );

        if (link.external) {
          return (
            <a
              key={`${link.title}-${index}-${link.href}`}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {linkContent}
            </a>
          );
        }

        return (
          <Link key={`${link.title}-${index}-${link.href}`} href={link.href}>
            {linkContent}
          </Link>
        );
      })}
    </div>
  );
}

export function HelpCenterClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [venueId, setVenueId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch venueId from user's session
  useEffect(() => {
    const fetchVenueId = async () => {
      try {
        const supabase = await createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;

        if (!user) {
          setIsLoading(false);
          return;
        }

        // Try to get venueId from storage first
        let foundVenueId: string | null =
          localStorage.getItem("currentVenueId") || localStorage.getItem("venueId") || null;

        // Check sessionStorage
        if (!foundVenueId) {
          const cachedVenueId = sessionStorage.getItem(`venue_id_${user.id}`);
          if (cachedVenueId) {
            foundVenueId = cachedVenueId;
          }
        }

        // If not in storage, fetch from database
        if (!foundVenueId) {
          const { data: ownerVenues } = await supabase
            .from("venues")
            .select("venue_id")
            .eq("owner_user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(1);

          if (ownerVenues && ownerVenues.length > 0) {
            foundVenueId = ownerVenues[0]?.venue_id as string;
            sessionStorage.setItem(`venue_id_${user.id}`, foundVenueId);
          } else {
            const { data: staffVenue } = await supabase
              .from("user_venue_roles")
              .select("venue_id")
              .eq("user_id", user.id)
              .limit(1)
              .single();

            if (staffVenue?.venue_id) {
              foundVenueId = staffVenue.venue_id as string;
              sessionStorage.setItem(`venue_id_${user.id}`, foundVenueId);
            }
          }
        }

        setVenueId(foundVenueId);
      } catch (error) { /* Error handled silently */ } finally {
        setIsLoading(false);
      }
    };

    fetchVenueId();
  }, []);

  // Build exactly 7 links - no duplicates possible
  const quickLinks: QuickLink[] = useMemo(() => {
    // Quick links memoized

    if (isLoading) {
      return [];
    }

    if (!venueId) {
      const links = [
        {
          title: "Getting Started Guide",
          href: "https://servio.uk/support",
          icon: BookOpen,
          external: true,
        },
      ];

      return links;
    }

    // Build exactly 7 links - hardcoded, no way to duplicate
    const links: QuickLink[] = [
      {
        title: "Getting Started Guide",
        href: "https://servio.uk/support",
        icon: BookOpen,
        external: true,
      },
      {
        title: "Menu Setup",
        href: `/dashboard/${venueId}/menu-management`,
        icon: ShoppingBag,
        external: false,
      },
      {
        title: "QR Code Setup",
        href: `/dashboard/${venueId}/qr-codes`,
        icon: QrCode,
        external: false,
      },
      {
        title: "Order Management",
        href: `/dashboard/${venueId}/live-orders`,
        icon: MessageSquare,
        external: false,
      },
      {
        title: "Analytics",
        href: `/dashboard/${venueId}/analytics`,
        icon: BarChart,
        external: false,
      },
      {
        title: "Staff Management",
        href: `/dashboard/${venueId}/staff`,
        icon: Users,
        external: false,
      },
      {
        title: "Settings",
        href: `/dashboard/${venueId}/settings`,
        icon: Settings,
        external: false,
      },
    ];

    // Safety check - if somehow we have duplicates, filter them
    const seen = new Set<string>();
    const unique = links.filter((link) => {
      if (seen.has(link.title)) {
        return false;
      }
      seen.add(link.title);
      return true;
    });

    return unique;
  }, [venueId, isLoading]);

  const filteredFAQs = faqs
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((category) => category.questions.length > 0);

  // Removed logging that was trying to serialize React components

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <NavigationBreadcrumb showBackButton={false} />

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
            <HelpCircle className="h-8 w-8 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Help Center</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions and learn how to get the most out of Servio
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
        </div>

        {/* Quick Links - Exactly 7 links, no duplicates */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Links</h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <Card key={`skeleton-${i}`} className="h-full animate-pulse">
                  <CardContent className="p-6 text-center">
                    <div className="h-8 w-8 bg-gray-200 rounded mx-auto mb-3" />
                    <div className="h-4 w-24 bg-gray-200 rounded mx-auto" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <QuickLinksGrid links={quickLinks} />
          )}
        </div>

        {/* FAQs */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            {searchQuery
              ? `Search Results (${filteredFAQs.reduce((acc, cat) => acc + cat.questions.length, 0)} found)`
              : "Frequently Asked Questions"}
          </h2>

          {filteredFAQs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-600">
                  No results found for "{searchQuery}". Try different keywords.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {filteredFAQs.map((category) => (
                <Card key={category.category}>
                  <CardHeader>
                    <CardTitle className="text-lg">{category.category}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible>
                      {category.questions.map((faq, index) => (
                        <AccordionItem key={index} value={`${category.category}-${index}`}>
                          <AccordionTrigger className="text-left font-medium">
                            {faq.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-gray-600">
                            {faq.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </Accordion>
          )}
        </div>

        {/* Contact Support */}
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-8 text-center">
            <Mail className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold text-gray-900 mb-2">Still need help?</h3>
            <p className="text-gray-600 mb-6">
              Our support team is here to help you get the most out of Servio
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-purple-600 hover:bg-purple-700">
                <a href="mailto:support@servio.app">
                  <Mail className="mr-2 h-5 w-5" />
                  Email Support
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="mailto:hello@servio.app">General Inquiries</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
