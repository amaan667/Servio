import { createClient as SupabaseCreateClient } from "@supabase/supabase-js"
import { logger } from "./logger"

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const hasSupabaseConfig = !!(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseConfig ? SupabaseCreateClient(supabaseUrl!, supabaseAnonKey!) : null

// Types
export interface User {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface Venue {
  id: string
  venue_id: string
  name: string
  business_type: string
  address?: string
  phone?: string
  email?: string
  owner_id: string
  created_at: string
}

export interface MenuItem {
  id: string
  venue_id: string
  name: string
  description?: string
  price: number
  category: string
  available: boolean
  created_at: string
}

export interface Order {
  id: string
  order_number: number
  venue_id: string
  table_number: number
  customer_name: string
  customer_phone?: string
  status: string
  total_amount: number
  notes?: string
  created_at: string
}

export interface AuthSession {
  user: User
  venue: Venue
}

// Session management
let currentSession: AuthSession | null = null

export function setSession(session: AuthSession | null) {
  currentSession = session
  if (typeof window !== "undefined") {
    if (session) {
      localStorage.setItem("servio_session", JSON.stringify(session))
    } else {
      localStorage.removeItem("servio_session")
    }
  }
}

export function getValidatedSession(): AuthSession | null {
  if (currentSession) return currentSession

  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("servio_session")
    if (stored) {
      try {
        const session = JSON.parse(stored)
        currentSession = session
        return session
      } catch (error) {
        logger.error("Failed to parse stored session", { error })
        localStorage.removeItem("servio_session")
      }
    }
  }

  return null
}

export function clearSession() {
  currentSession = null
  if (typeof window !== "undefined") {
    localStorage.removeItem("servio_session")
  }
}

// Auth functions
export async function signUpUser(email: string, password: string, fullName: string, venueName: string, venueType: string) {
  if (!supabase) {
    return { success: false, message: "Database connection not available" }
  }

  try {
    logger.info("Attempting sign up", { email, fullName })

    // Sign up with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin + '/dashboard' : undefined,
        data: { full_name: fullName },
      },
    })

    if (error || !data.user) {
      logger.error("Failed to sign up user", { error })
      return { success: false, message: error?.message || "Failed to create account" }
    }

    // Check for session (user is authenticated if session exists)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      // No session means email confirmation is required
      return { success: true, message: "Check your email to confirm your account. You'll be able to set up your business after confirming." }
    }

    // Create default venue for the user (as authenticated user)
    const userId = data.user.id
    const venueId = `venue-${userId.slice(0, 8)}`
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
      if (createVenueError && createVenueError.code === '23505') { // Unique violation
        // Venue already exists, fetch it
        const { data: existingVenue, error: fetchError } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", userId)
          .single();
        if (fetchError || !existingVenue) {
          logger.error("Failed to fetch existing venue after unique violation", { error: fetchError })
          return { success: false, message: "Failed to fetch existing venue for this user" }
        }
        venueData = existingVenue;
      } else if (createVenueError || !newVenue) {
        logger.error("Failed to create venue", { error: createVenueError })
        return { success: false, message: "Failed to set up your business" }
      } else {
        venueData = newVenue;
      }
    }
    // Set session (for client-side convenience)
    const session: AuthSession = {
      user: {
        id: userId,
        email: data.user.email!,
        full_name: fullName,
        created_at: data.user.created_at!,
      },
      venue: venueData,
    }
    setSession(session)
    logger.info("Sign up successful", { userId, venueId })
    return { success: true, session }
  } catch (error) {
    logger.error("Sign up error", { error })
    return { success: false, message: "An unexpected error occurred" }
  }
}

export async function signInUser(email: string, password: string) {
  if (!supabase) {
    return { success: false, message: "Database connection not available" }
  }

  try {
    logger.info("Attempting sign in", { email })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      logger.error("Sign in failed", { error })
      return { success: false, message: error?.message || "Invalid email or password" }
    }
    // Fetch venue for user
    const userId = data.user.id
    let { data: venueData, error: venueError } = await supabase
      .from("venues")
      .select("*")
      .eq("owner_id", userId)
      .single()
    if (venueError || !venueData) {
      // Try to create a venue for this user
      const venueId = `venue-${userId.slice(0, 8)}`
      const defaultVenueName = data.user.user_metadata?.venueName || (data.user.user_metadata?.full_name ? `${data.user.user_metadata.full_name.split(' ')[0]}'s Venue` : "My Venue");
      const { data: newVenue, error: createVenueError } = await supabase
        .from("venues")
        .insert({
          venue_id: venueId,
          name: defaultVenueName,
          business_type: data.user.user_metadata?.venueType || "restaurant",
          owner_id: userId,
        })
        .select()
        .single();
      if (createVenueError && createVenueError.code === '23505') { // Unique violation
        // Venue already exists, fetch it
        const { data: existingVenue, error: fetchError } = await supabase
          .from("venues")
          .select("*")
          .eq("owner_id", userId)
          .single();
        if (fetchError || !existingVenue) {
          logger.error("Failed to fetch existing venue after unique violation", { error: fetchError })
          return { success: false, message: "Failed to fetch existing venue for this user" }
        }
        venueData = existingVenue;
      } else if (createVenueError || !newVenue) {
        logger.error("Failed to create venue on sign-in", { error: createVenueError })
        return { success: false, message: "Failed to create venue for this user" }
      } else {
        venueData = newVenue;
      }
    }
    // Set session (for client-side convenience)
    const session: AuthSession = {
      user: {
        id: userId,
        email: data.user.email!,
        full_name: data.user.user_metadata?.full_name || "",
        created_at: data.user.created_at!,
      },
      venue: venueData,
    }
    setSession(session)
    return { success: true, session }
  } catch (error) {
    logger.error("Sign in error", { error })
    return { success: false, message: "An unexpected error occurred" }
  }
}

// Sign out function
export async function signOutUser() {
  if (!supabase) return
  try {
    await supabase.auth.signOut()
    clearSession()
    logger.info("User signed out")
  } catch (error) {
    logger.error("Sign out error", { error })
  }
}

// Menu functions
export async function createMenuItem(venueId: string, item: Omit<MenuItem, "id" | "venue_id" | "created_at">) {
  if (!supabase) {
    return { success: false, message: "Database connection not available" }
  }

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        venue_id: venueId,
        ...item,
      })
      .select()
      .single()

    if (error) {
      logger.error("Failed to create menu item", { error, venueId })
      return { success: false, message: "Failed to create menu item" }
    }

    logger.info("Menu item created", { itemId: data.id, venueId })
    return { success: true, data }
  } catch (error) {
    logger.error("Create menu item error", { error })
    return { success: false, message: "An unexpected error occurred" }
  }
}

export async function updateMenuItem(itemId: string, updates: Partial<MenuItem>) {
  if (!supabase) {
    return { success: false, message: "Database connection not available" }
  }

  try {
    const { data, error } = await supabase.from("menu_items").update(updates).eq("id", itemId).select().single()

    if (error) {
      logger.error("Failed to update menu item", { error, itemId })
      return { success: false, message: "Failed to update menu item" }
    }

    logger.info("Menu item updated", { itemId })
    return { success: true, data }
  } catch (error) {
    logger.error("Update menu item error", { error })
    return { success: false, message: "An unexpected error occurred" }
  }
}

export async function deleteMenuItem(itemId: string) {
  if (!supabase) {
    return { success: false, message: "Database connection not available" }
  }

  try {
    const { error } = await supabase.from("menu_items").delete().eq("id", itemId)

    if (error) {
      logger.error("Failed to delete menu item", { error, itemId })
      return { success: false, message: "Failed to delete menu item" }
    }

    logger.info("Menu item deleted", { itemId })
    return { success: true }
  } catch (error) {
    logger.error("Delete menu item error", { error })
    return { success: false, message: "An unexpected error occurred" }
  }
}

// Order functions
export async function createOrder(orderData: {
  venue_id: string
  table_number: number
  customer_name: string
  customer_phone?: string
  items: Array<{
    menu_item_id: string
    quantity: number
    price: number
    item_name: string
  }>
  total_amount: number
  notes?: string
}) {
  if (!supabase) {
    return { success: false, message: "Database connection not available" }
  }

  try {
    logger.info("Creating order", { venueId: orderData.venue_id, tableNumber: orderData.table_number, customerName: orderData.customer_name, itemCount: orderData.items.length, totalAmount: orderData.total_amount })

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
      .single()

    if (orderError || !order) {
      logger.error("Failed to create order", { error: orderError })
      return { success: false, message: "Failed to create order" }
    }

    // Create order items
    const orderItems = orderData.items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }))

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

    if (itemsError) {
      logger.error("Failed to create order items", { error: itemsError })
      return { success: false, message: "Failed to create order items" }
    }

    logger.info("Order created successfully", { orderId: order.id, orderNumber: order.order_number })

    return { success: true, data: order }
  } catch (error) {
    logger.error("Create order error", { error })
    return { success: false, message: "An unexpected error occurred" }
  }
}

// Venue functions
export async function createVenueIfNotExists(venueId: string) {
  if (!supabase) {
    throw new Error("Database connection not available")
  }

  // Try to find existing venue
  const { data: existingVenue, error: findError } = await supabase
    .from("venues")
    .select("*")
    .eq("venue_id", venueId)
    .single()

  if (existingVenue && !findError) {
    return existingVenue
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
    .single()

  if (createError || !newVenue) {
    throw new Error(`Failed to create venue: ${createError?.message}`)
  }

  return newVenue
}

// Export validation function
export const validateSession = getValidatedSession

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase config missing")
  return SupabaseCreateClient(supabaseUrl, supabaseAnonKey)
}
