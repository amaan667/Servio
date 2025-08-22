import { createBrowserClient } from "@supabase/ssr";
import { logger } from "./logger";
import { supabaseBrowser } from "./supabase-browser";

console.log('🔄 Initializing Supabase client...');

// Environment variables with safe access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug environment variables with detailed logging
console.log("Supabase environment check:", {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "undefined",
  key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : "undefined",
  nodeEnv: process.env.NODE_ENV,
  timestamp: new Date().toISOString()
});

// Function to create Supabase client with error handling
function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    const missingVars = {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey
    };
    
    console.error("❌ Missing Supabase environment variables:", {
      ...missingVars,
      availableVars: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      processId: process.pid
    });
    
    const missingVarNames = Object.entries(missingVars)
      .filter(([_, present]) => !present)
      .map(([name]) => name);
      
    const errorMessage = `Missing Supabase environment variables: ${missingVarNames.join(', ')}`;
    console.error('💥 SUPABASE INITIALIZATION FAILED:', errorMessage);
    
    // During build time, return a mock client to prevent build failures
    // Check if we're in a build context by looking for missing Railway environment
    const isProduction = process.env.NODE_ENV === 'production';
    const hasRailwayEnv = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID);
    const isBuildTime = isProduction && !hasRailwayEnv;
    
    if (isBuildTime) {
      console.warn('⚠️ Detected build-time context - returning mock client to prevent build failures');
      console.warn('   Production environment detected but no Railway environment variables present');
      return createMockSupabaseClient();
    }
    
    throw new Error(errorMessage);
  }

  try {
    // Create single Supabase client instance with proper configuration
    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
    console.log("✅ Supabase client created successfully");
    return client;
  } catch (error) {
    console.error('💥 Failed to create Supabase client:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'undefined',
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

// Mock client for build time
function createMockSupabaseClient() {
  return {
    auth: {
      signUp: () => Promise.resolve({ data: null, error: new Error('Mock client - not available during build') }),
      signInWithOAuth: () => Promise.resolve({ data: null, error: new Error('Mock client - not available during build') }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
      insert: () => Promise.resolve({ data: [], error: null }),
      update: () => Promise.resolve({ data: [], error: null }),
      delete: () => Promise.resolve({ data: [], error: null }),
      upsert: () => Promise.resolve({ data: [], error: null }),
      eq: function() { return this; },
      in: function() { return this; },
      filter: function() { return this; },
      order: function() { return this; },
      limit: function() { return this; },
    }),
    rpc: () => Promise.resolve({ data: null, error: null }),
  } as any;
}

export const supabase = createSupabaseClient();

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

    // ALWAYS use Railway production URL - never localhost
    const emailRedirectTo = process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
      : "https://servio-production.up.railway.app/dashboard";
    
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

    logger.info("User signed up successfully", { userId, venueId });
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
  const supabase = supabaseBrowser();
  const redirectTo = 'https://servio-production.up.railway.app/auth/callback';
  console.log('[AUTH] starting oauth with redirect:', redirectTo);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo, // must be EXACT and allowed in Supabase dashboard
      queryParams: { prompt: 'select_account' },
    },
  });

  if (error) throw error;
  return data;
}

// Handle Google OAuth sign-up and create venue
export async function handleGoogleSignUp(userId: string, userEmail: string, fullName?: string) {
  try {
    console.log("Creating venue for Google sign-up user:", userId);
    
    // Check if user already has a venue
    const { data: existingVenue, error: checkError } = await supabase
      .from("venues")
      .select("*")
      .eq("owner_id", userId)
      .single();

    if (existingVenue && !checkError) {
      console.log("User already has venue:", existingVenue.venue_id);
      return { success: true, venue: existingVenue };
    }

    // Create default venue for new Google user
    const venueId = `venue-${userId.slice(0, 8)}`;
    const venueName = fullName ? `${fullName}'s Business` : "My Business";
    
    const { data: newVenue, error: createError } = await supabase
      .from("venues")
      .insert({
        venue_id: venueId,
        name: venueName,
        business_type: "Restaurant",
        owner_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create venue for Google user:", createError);
      return { success: false, error: createError.message };
    }

    console.log("Created venue for Google user:", newVenue.venue_id);
    return { success: true, venue: newVenue };
  } catch (error) {
    console.error("Error in handleGoogleSignUp:", error);
    return { success: false, error: "Failed to create venue" };
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