import { redirect } from "next/navigation";

// Demo route redirects to demo venue order page
export default function DemoPage() {
  redirect("/order?venue=demo-cafe&table=1&demo=true");
}
