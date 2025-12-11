import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { getBaseUrl } from "@/lib/getBaseUrl";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut(); // clears cookies
  return NextResponse.redirect(`${await getBaseUrl()}/`);
}
