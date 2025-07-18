"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus, ShoppingCart, Clock, Star } from "lucide-react"
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

  const categories = ["all", "appetizers", "mains", "desserts", "beverages"]

  const searchParams = useSearchParams()
  const venueId = searchParams?.get("venue") || "amaantanveer667-venue"

  useEffect(() => {
    loadMenuItems()
  }, [])

  const loadMenuItems = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
        .from("menu_items")
        .select("*")
      .eq("available", true)
        .eq("venue_id", venueId)
        .order("category", { ascending: true })

    if (data && !error) {
      setMenuItems(data)
    }
  }

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return prev.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
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
          cartItem.id === itemId ? { ...cartItem, quantity: cartItem.quantity - 1 } : cartItem,
        )
      }
      return prev.filter((cartItem) => cartItem.id !== itemId)
    })
  }

  const updateSpecialInstructions = (itemId: string, instructions: string) => {
    setCart((prev) =>
      prev.map((cartItem) => (cartItem.id === itemId ? { ...cartItem, special_instructions: instructions } : cartItem)),
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
      // Create order
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

  if (orderSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Submitted!</h2>
            <p className="text-gray-600 mb-6">Your order has been received and is being prepared.</p>
            <Button onClick={() => setOrderSubmitted(false)} className="w-full">
              Place Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Image src="/assets/servio-logo-updated.png" alt="Servio Logo" width={0} height={48} style={{ height: 48, width: "auto" }} priority />
              <h1 className="text-2xl font-bold text-gray-900">Order Menu</h1>
            </div>
              <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">{getTotalItems()} items</span>
              <span className="text-green-600 font-bold">${getTotalPrice().toFixed(2)}</span>
              </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Items */}
          <div className="lg:col-span-2">
            {/* Category Filter */}
            <div className="flex space-x-2 mb-6 overflow-x-auto">
              {categories.map((category) => (
                                    <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  className="whitespace-nowrap capitalize"
                                    >
                  {category}
                                    </Button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg">{item.name}</h3>
                      <div className="flex items-center space-x-1">
                        {item.rating && (
                          <>
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm text-gray-600">{item.rating}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-3">{item.description}</p>

                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xl font-bold text-green-600">${item.price.toFixed(2)}</span>
                      {item.prep_time && (
                        <div className="flex items-center text-gray-500 text-sm">
                          <Clock className="w-4 h-4 mr-1" />
                          {item.prep_time} min
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="capitalize">
                        {item.category}
                      </Badge>

                      <div className="flex items-center space-x-2">
                        {cart.find((cartItem) => cartItem.id === item.id) ? (
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline" onClick={() => removeFromCart(item.id)}>
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="font-medium">
                              {cart.find((cartItem) => cartItem.id === item.id)?.quantity}
                                    </span>
                            <Button size="sm" onClick={() => addToCart(item)}>
                              <Plus className="w-4 h-4" />
                                  </Button>
                          </div>
                        ) : (
                          <Button onClick={() => addToCart(item)}>Add to Cart</Button>
                        )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
              ))}
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
                <CardHeader>
                <CardTitle>Your Order</CardTitle>
                </CardHeader>
              <CardContent className="space-y-4">
                  {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">Your cart is empty</p>
                  ) : (
                  <>
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.id} className="border-b pb-3">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{item.name}</h4>
                            <span className="font-bold">${(item.price * item.quantity).toFixed(2)}</span>
                          </div>

                          <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                              <Button size="sm" variant="outline" onClick={() => removeFromCart(item.id)}>
                                <Minus className="w-3 h-3" />
                            </Button>
                              <span>{item.quantity}</span>
                              <Button size="sm" onClick={() => addToCart(item)}>
                                <Plus className="w-3 h-3" />
                            </Button>
                            </div>
                            <span className="text-sm text-gray-600">${item.price.toFixed(2)} each</span>
                          </div>

                          <Textarea
                            placeholder="Special instructions..."
                            value={item.special_instructions || ""}
                            onChange={(e) => updateSpecialInstructions(item.id, e.target.value)}
                            className="text-sm"
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total:</span>
                        <span className="text-green-600">${getTotalPrice().toFixed(2)}</span>
                      </div>
                        </div>

                    {/* Customer Info */}
                    <div className="space-y-3 border-t pt-3">
                      <Input
                        placeholder="Your name *"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo((prev) => ({ ...prev, name: e.target.value }))}
                      />
                          <Input
                        placeholder="Phone number *"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                      <Input
                        placeholder="Table number (optional)"
                        value={customerInfo.table_number}
                        onChange={(e) => setCustomerInfo((prev) => ({ ...prev, table_number: e.target.value }))}
                          />
                        </div>

                    {/* Submit Button */}
                    <Button onClick={submitOrder} disabled={isSubmitting || cart.length === 0} className="w-full">
                      {isSubmitting ? "Submitting..." : "Place Order"}
                        </Button>
                  </>
                  )}
                </CardContent>
              </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
