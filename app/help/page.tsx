import { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {
  title: "Help Center | Servio",
  description: "Get help with Servio - guides, FAQs, and support resources",
};

// Dynamically import with error handling to prevent chunk loading errors
const HelpCenterClient = dynamic(
  () => import("./HelpCenterClient").then((mod) => ({ default: mod.HelpCenterClient })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Help Center...</p>
        </div>
      </div>
    ),
  }
);

export default function HelpCenterPage() {
  return <HelpCenterClient />;
}

