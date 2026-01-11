import { Metadata } from "next";
import dynamic from "next/dynamic";

export const metadata: Metadata = {

  description: "Get help with Servio - guides, FAQs, and support resources",
};

// Dynamically import with error handling to prevent chunk loading errors
const HelpCenterClient = dynamic(
  () => import("./HelpCenterClient").then((mod) => ({ default: mod.HelpCenterClient })),
  {

  }
);

export default function HelpCenterPage() {
  return <HelpCenterClient />;
}
