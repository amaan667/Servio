"use client";
import { logger } from "./logger";
import { supabase } from "./supabase/client";
import { getAuthRedirectUrl } from "./auth";

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
  image?: string; // image URL for menu items
}

export interface Order {
  id: string;
  venue_id: string;
  table_number: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  order_status: string;
  total_amount: number;
  notes?: string;
  payment_method?: string;
  payment_status?: string;
  scheduled_for?: string;
  prep_lead_minutes?: number;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    price: number;
    item_name: string;
    specialInstructions?: string;
  }>;
  created_at: string;
  updated_at: string;
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
  // Order already includes items field, so this interface is just an alias
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
    logger.log("Attempting sign up", { email, fullName });

    // Use normalized site origin
    const emailRedirectTo = `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://servio-production.up.railway.app').replace(/[;\s]+$/g, '').replace(/\/+$/g, '')}/dashboard`;
    
    console.log("✅ Using Railway domain for email redirect:", emailRedirectTo);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
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

    // Check for user (user is authenticated if user exists)
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      // No user means email confirmation is required
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
          business_type: venueType.toLowerCase(),
          owner_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createVenueError) {
        logger.error("Failed to create venue", { error: createVenueError });
        return {
          success: false,
          message: "Account created but failed to set up venue. Please contact support.",
        };
      }
      venueData = newVenue;
    }

    logger.log("User signed up successfully", { userId, venueId });
    return {
      success: true,
      message: "Account created successfully! Welcome to Servio.",
      data: { user: data.user, venue: venueData },
    };
  } catch (error) {
    logger.error("Sign up error", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

export async function signInUser(email: string, password: string) {
  try {
    logger.log("Attempting sign in", { email });
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
    
    logger.log("Sign in successful", { userId: data.user.id });
    
    // Ensure user is properly authenticated
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      logger.error("No user after sign in");
      return {
        success: false,
        message: "Authentication failed - user not authenticated",
      };
    }
    
    return { success: true };
  } catch (error) {
    logger.error("Sign in error", { error });
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getAuthRedirectUrl('/auth/callback') },
  })
}

// Handle Google OAuth sign-up and create venue
export async function handleGoogleSignUp(userId: string, userEmail: string, fullName?: string) {
  try {
    // Check if user already has a venue
    const { data: existingVenue, error: checkError } = await supabase
      .from("venues")
      .select("*")
      .eq("owner_id", userId)
      .single();

    if (existingVenue && !checkError) {
      return { success: true, venue: existingVenue };
    }

    // Create default venue for new Google user
    const venueId = `venue-${userId.slice(0,8)}`;
    const venueName = fullName ? `${fullName}'s Business` : "My Business";
    
    const { data: newVenue, error: createError } = await supabase
      .from("venues")
      .insert({
        venue_id: venueId,
        name: venueName,
        business_type: "Cafe",
        owner_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      return { success: false, error: createError.message };
    }

    return { success: true, venue: newVenue };
  } catch (error) {
    return { success: false, error: "Failed to create venue" };
  }
}

// Sign out function
export async function signOutUser() {
  try {
    // Use server-side signout API instead of client-side auth.signOut()
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      logger.log("User signed out");
    } else {
      logger.error("Server signout failed", { status: response.status });
    }
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
    console.log('[OAUTH FLOW] Step 4: OAuth error occurred');
    console.log('[OAUTH FLOW] Error details: ', error);
      logger.error("Failed to create menu item", { error, venueId });
      return { success: false, message: "Failed to create menu item" };
    }

    logger.log("Menu item created", { itemId: data.id, venueId });
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
    console.log('[OAUTH FLOW] Step 4: OAuth error occurred');
    console.log('[OAUTH FLOW] Error details: ', error);
      logger.error("Failed to update menu item", { error, itemId });
      return { success: false, message: "Failed to update menu item" };
    }

    logger.log("Menu item updated", { itemId });
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
    console.log('[OAUTH FLOW] Step 4: OAuth error occurred');
    console.log('[OAUTH FLOW] Error details: ', error);
      logger.error("Failed to delete menu item", { error, itemId });
      return { success: false, message: "Failed to delete menu item" };
    }

    logger.log("Menu item deleted", { itemId });
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
  customer_phone: string; // Make this required since DB schema requires it
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
    console.log('[ORDER CREATION DEBUG] ===== CREATE ORDER FUNCTION CALLED =====');
    console.log('[ORDER CREATION DEBUG] Raw order data received:', orderData);
    console.log('[ORDER CREATION DEBUG] Data validation:');
    console.log('[ORDER CREATION DEBUG] - venue_id:', orderData.venue_id, '(type:', typeof orderData.venue_id, ')');
    console.log('[ORDER CREATION DEBUG] - table_number:', orderData.table_number, '(type:', typeof orderData.table_number, ')');
    console.log('[ORDER CREATION DEBUG] - customer_name:', orderData.customer_name, '(type:', typeof orderData.customer_name, ')');
    console.log('[ORDER CREATION DEBUG] - customer_phone:', orderData.customer_phone, '(type:', typeof orderData.customer_phone, ')');
    console.log('[ORDER CREATION DEBUG] - items array length:', orderData.items.length);
    console.log('[ORDER CREATION DEBUG] - total_amount:', orderData.total_amount, '(type:', typeof orderData.total_amount, ')');
    console.log('[ORDER CREATION DEBUG] - notes:', orderData.notes);

    // Calculate total amount from items (always use this, not the passed total_amount)
    console.log('[ORDER CREATION DEBUG] Calculating total from items...');
    const calculatedTotal = orderData.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      console.log(`[ORDER CREATION DEBUG] Item: ${item.item_name}, price: ${item.price}, qty: ${item.quantity}, total: ${itemTotal}`);
      return sum + itemTotal;
    }, 0);
    console.log('[ORDER CREATION DEBUG] Calculated total:', calculatedTotal);
    console.log('[ORDER CREATION DEBUG] Passed total_amount:', orderData.total_amount);
    console.log('[ORDER CREATION DEBUG] Total difference:', Math.abs(calculatedTotal - orderData.total_amount));
    
    // Create the order with items as JSONB
    console.log('[ORDER CREATION DEBUG] Preparing database insertion...');
    const insertData = {
      venue_id: orderData.venue_id,
      table_number: orderData.table_number,
      customer_name: orderData.customer_name,
      customer_phone: orderData.customer_phone,
      order_status: "PLACED",
      payment_status: "UNPAID",
      total_amount: calculatedTotal, // Always use calculated total
      notes: orderData.notes,
      items: orderData.items, // Store items as JSONB
    };
    console.log('[ORDER CREATION DEBUG] Insert data prepared:', insertData);
    console.log('[ORDER CREATION DEBUG] Calling Supabase insert...');
    
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(insertData)
      .select()
      .single();
    
    console.log('[ORDER CREATION DEBUG] Supabase insert completed');
    console.log('[ORDER CREATION DEBUG] Insert result - data:', order);
    console.log('[ORDER CREATION DEBUG] Insert result - error:', orderError);

    if (orderError || !order) {
      console.error('[ORDER CREATION DEBUG] Failed to create order:', orderError);
      console.error('[ORDER CREATION DEBUG] Order data that failed:', {
        venue_id: orderData.venue_id,
        table_number: orderData.table_number,
        customer_name: orderData.customer_name,
        total_amount: calculatedTotal,
        items: orderData.items
      });
      return { success: false, message: `Failed to create order: ${orderError?.message || 'Unknown error'}` };
    }

    console.log('[ORDER CREATION DEBUG] Order created successfully:', {
      orderId: order.id,
      calculatedTotal,
      orderData: order
    });

    return { success: true, data: order };
  } catch (error) {
    console.error('[ORDER CREATION DEBUG] Create order error:', error);
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
              business_type: "Cafe",
    })
    .select()
    .single();

  if (createError || !newVenue) {
    throw new Error(`Failed to create venue: ${createError?.message}`);
  }

  return newVenue;
}

// Test function to verify OAuth redirect URLs
export function testOAuthRedirects() {
  console.log('[AUTH TEST] Testing OAuth redirect configuration...');
  
  // Test 1: Verify environment variables are set correctly
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://servio-production.up.railway.app';
  console.log('[AUTH TEST] Environment URL:', envUrl);
  console.log('[AUTH TEST] NEXT_PUBLIC_SITE_URL:', process.env.NEXT_PUBLIC_SITE_URL);
  console.log('[AUTH TEST] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  
  // Test 2: Verify no localhost in environment URLs
  const envUrls = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    envUrl
  ].filter(Boolean);
  
  const hasLocalhost = envUrls.some(url => url && (url.includes('localhost') || url.includes('127.0.0.1')));
  
  if (hasLocalhost) {
    console.error('[AUTH TEST] ❌ FAILED: Found localhost in environment URLs!');
    console.error('[AUTH TEST] Problematic URLs:', envUrls.filter(url => url && (url.includes('localhost') || url.includes('127.0.0.1'))));
    return false;
  }
  
  // Test 3: Verify expected redirect URL format
  const expectedRedirectTo = `${envUrl.replace(/\/+$/, '')}/auth/callback`;
  console.log('[AUTH TEST] Expected redirect URL:', expectedRedirectTo);
  
  if (expectedRedirectTo.includes('localhost') || expectedRedirectTo.includes('127.0.0.1')) {
    console.error('[AUTH TEST] ❌ FAILED: Expected redirect URL contains localhost!');
    return false;
  }
  
  console.log('[AUTH TEST] ✅ PASSED: No localhost found in any URLs');
  return true;
}