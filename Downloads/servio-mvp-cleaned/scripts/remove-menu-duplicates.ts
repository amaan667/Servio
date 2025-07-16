import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase config. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeDuplicates(venueId: string) {
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, price, category, venue_id")
    .eq("venue_id", venueId);

  if (error) {
    console.error("Failed to fetch menu items:", error.message);
    process.exit(1);
  }

  const seen = new Map<string, string>(); // key: name|price|category, value: id to keep
  const toDelete: string[] = [];

  for (const item of items || []) {
    const key = `${item.name.trim().toLowerCase()}|${Number(item.price)}|${(item.category || "").trim().toLowerCase()}`;
    if (seen.has(key)) {
      toDelete.push(item.id);
    } else {
      seen.set(key, item.id);
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicates found.");
    return;
  }

  const { error: delError } = await supabase.from("menu_items").delete().in("id", toDelete);
  if (delError) {
    console.error("Failed to delete duplicates:", delError.message);
    process.exit(1);
  }
  console.log(`Deleted ${toDelete.length} duplicate menu items.`);
}

const venueId = process.argv[2];
if (!venueId) {
  console.error("Usage: pnpm tsx scripts/remove-menu-duplicates.ts <venue_id>");
  process.exit(1);
}

removeDuplicates(venueId).then(() => process.exit(0)); 