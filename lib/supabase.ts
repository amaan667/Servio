import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create single Supabase client instance
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Venue {
  id: string;
  venue_id: string;
  name: string;
  business_type: string;
  address?: string;
  phone?: string;
  email?: string;
  owner_id: string;
  created_at: string;
}

export interface MenuItem {
  id: string;
  venue_id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  status: string;
  total_amount: number;
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item_name: string;
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export interface AuthSession {
  user: User;
  venue: Venue;
}

// Auth functions
export async function signUpUser(
  email: string,
  password: string,
  fullName: string,
  venueName: string,
  venueType: string,
) {
  try {
    logger.info("Attempting sign up", { email, fullName });

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? window.location.origin + "/dashboard"
            : undefined,
        data: { full_name: fullName },
      },
    });

    if (error || !data.user) {
      logger.error("Failed to sign up user", { error });
      return {
        success: false,
        message: error?.message || "Failed to create account",
      };
    }

    // Check for session (user is authenticated if session exists)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      // No session means email confirmation is required
      return {
        success: true,
        message:
          "Check your email to confirm your account. You'll be able to set up your business after confirming.",
      };
    }

    // Create default venue for the user (as authenticated user)
    const userId = data.user.id;
    const venueId = `venue-${userId.slice(0, 8)}`;
    let { data: venueData, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("owner_id", userId)
      .single();
    if (venueError || !venueData) {
      const { data: newVenue, error: createVenueError } = await supabase
        .from("venues")
        .insert({
          venue_id: venueId,
          name: venueName,
          business_type: venueType,
          owner_id: userId,
        })
        .select()
        .single();
      if (createVenueError && createVenueError.code === "23505") {
        // Unique violation
        // Venue already exists, fetch it
        const { data: existingVenue, error: fetchError } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", userId)
          .single();
        if (fetchError || !existingVenue) {
          logger.error(
            "Failed to fetch existing venue after unique violation",
            { error: fetchError },
          );
          return {
            success: false,
            message: "Failed to fetch existing venue for this user",
          };
        }
        venueData = existingVenue;
      } else if (createVenueError || !newVenue) {
        logger.error("Failed to create venue", { error: createVenueError });
        return { success: false, message: "Failed to set up your business" };
      } else {
        venueData = newVenue;
      }
    }
    
    logger.info("Sign up successful", { userId, venueId });
    return { success: true };
  } catch (error) {
    logger.error("Sign up error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function signInUser(email: string, password: string) {
  try {
    logger.info("Attempting sign in", { email });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      logger.error("Sign in failed", { error });
      return {
        success: false,
        message: error?.message || "Invalid email or password",
      };
    }
    
    logger.info("Sign in successful", { userId: data.user.id });
    return { success: true };
  } catch (error) {
    logger.error("Sign in error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
        queryParams: { 
          access_type: "offline", 
          prompt: "consent" 
        }
      }
    });
    
    if (error) {
      console.error("Google OAuth error:", error);
      throw error;
    }
    
    console.log("Google OAuth initiated successfully");
    return data;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    throw error;
  }
}

// Sign out function
export async function signOutUser() {
  try {
    await supabase.auth.signOut();
    logger.info("User signed out");
  } catch (error) {
    logger.error("Sign out error", { error });
  }
}

// Menu functions
export async function createMenuItem(
  venueId: string,
  item: Omit<MenuItem, "id" | "venue_id" | "created_at">,
) {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        venue_id: venueId,
        ...item,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create menu item", { error, venueId });
      return { success: false, message: "Failed to create menu item" };
    }

    logger.info("Menu item created", { itemId: data.id, venueId });
    return { success: true, data };
  } catch (error) {
    logger.error("Create menu item error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updateMenuItem(
  itemId: string,
  updates: Partial<MenuItem>,
) {
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update menu item", { error, itemId });
      return { success: false, message: "Failed to update menu item" };
    }

    logger.info("Menu item updated", { itemId });
    return { success: true, data };
  } catch (error) {
    logger.error("Update menu item error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function deleteMenuItem(itemId: string) {
  try {
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      logger.error("Failed to delete menu item", { error, itemId });
      return { success: false, message: "Failed to delete menu item" };
    }

    logger.info("Menu item deleted", { itemId });
    return { success: true };
  } catch (error) {
    logger.error("Delete menu item error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

// Order functions
export async function createOrder(orderData: {
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
  }>;
  total_amount: number;
  notes?: string;
}) {
  try {
    logger.info("Creating order", {
      venueId: orderData.venue_id,
      tableNumber: orderData.table_number,
      customerName: orderData.customer_name,
      itemCount: orderData.items.length,
      totalAmount: orderData.total_amount,
    });

    // Create the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        venue_id: orderData.venue_id,
        table_number: orderData.table_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        status: "pending",
        total_amount: orderData.total_amount,
        notes: orderData.notes,
      })
      .select()
      .single();

    if (orderError || !order) {
      logger.error("Failed to create order", { error: orderError });
      return { success: false, message: "Failed to create order" };
    }

    // Create order items
    const orderItems = orderData.items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      logger.error("Failed to create order items", { error: itemsError });
      return { success: false, message: "Failed to create order items" };
    }

    logger.info("Order created successfully", {
      orderId: order.id,
      orderNumber: order.order_number,
    });

    return { success: true, data: order };
  } catch (error) {
    logger.error("Create order error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

// Venue functions
export async function createVenueIfNotExists(venueId: string) {
  // Try to find existing venue
  const { data: existingVenue, error: findError } = await supabase
    .from("venues")
    .select("*")
    .eq("venue_id", venueId)
    .single();

  if (existingVenue && !findError) {
    return existingVenue;
  }

  // Create venue if it doesn't exist
  const { data: newVenue, error: createError } = await supabase
    .from("venues")
    .insert({
      venue_id: venueId,
      name: `Business ${venueId}`,
      business_type: "Restaurant",
    })
    .select()
    .single();

  if (createError || !newVenue) {
    throw new Error(`Failed to create venue: ${createError?.message}`);
  }

  return newVenue;
}
