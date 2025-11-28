import { Metadata } from "next";
import { HelpCenterClient } from "./HelpCenterClient";

export const metadata: Metadata = {
  title: "Help Center | Servio",
  description: "Get help with Servio - guides, FAQs, and support resources",
};

export default function HelpCenterPage() {
  return <HelpCenterClient />;
}

