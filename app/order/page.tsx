"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus, ShoppingCart, Clock, Star, CreditCard, Apple, Smartphone } from "lucide-react"
import { createClient } from "@/lib/supabase"
import Image from "next/image"
import { useSearchParams } from "next/navigation"

interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url?: string
  available: boolean
  prep_time?: number
  rating?: number
}

interface CartItem extends MenuItem {
  quantity: number
  special_instructions?: string
}

export default function CustomerOrderPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    phone: "",
    table_number: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderSubmitted, setOrderSubmitted] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [menuError, setMenuError] = useState<string | null>(null)

  const categories = ["all", "appetizers", "mains", "desserts", "beverages"]

  const searchParams = useSearchParams()
  const venueId = searchParams?.get("venue") || "amaantanveer667-venue"

  useEffect(() => {
    loadMenuItems()
  }, [])

  const loadMenuItems = async () => {
    setLoadingMenu(true)
    setMenuError(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("available", true)
      .eq("venue_id", venueId)
      .order("category", { ascending: true })
    if (error) {
      setMenuError("Failed to load menu. Please try again later.")
      setMenuItems([])
    } else if (data && data.length > 0) {
      setMenuItems(data)
    } else {
      setMenuError("No menu items found for this venue.")
      setMenuItems([])
    }
    setLoadingMenu(false)
  }

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        )
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === itemId)
      if (existing && existing.quantity > 1) {
        return prev.map((cartItem) =>
          cartItem.id === itemId ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem
        )
      }
      return prev.filter((cartItem) => cartItem.id !== itemId)
    })
  }

  const updateSpecialInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((cartItem) => (cartItem.id === itemId ? { ...cartItem, special_instructions: instructions } : cartItem))
    )
  }

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const submitOrder = async () => {
    if (!customerInfo.name || !customerInfo.phone) {
      alert("Please fill in your name and phone number")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()

    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_name: customerInfo.name,
          customer_phone: customerInfo.phone,
          table_number: customerInfo.table_number || null,
          total_amount: getTotalPrice(),
          status: "pending",
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            special_instructions: item.special_instructions,
          })),
        })
        .select()
        .single()

      if (orderError) throw orderError

      setOrderSubmitted(true)
      setCart([])
      setCustomerInfo({ name: "", phone: "", table_number: "" })
    } catch (error) {
      console.error("Error submitting order:", error)
      alert("Failed to submit order. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredItems =
    selectedCategory === "all" ? menuItems : menuItems.filter((item) => item.category === selectedCategory)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* UI content here */}
    </div>
  )
}

