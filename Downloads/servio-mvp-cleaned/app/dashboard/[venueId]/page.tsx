"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ExternalLink, QrCode, AlertTriangle, RefreshCw } from "lucide-react"
import { MenuManagement } from "@/components/menu-management"
import { LiveOrders } from "@/components/live-orders"
import { getValidatedSession, signOutUser, type AuthSession } from "@/lib/supabase"
import { logger } from "@/lib/logger"

export default function VenueDashboard() {
  const params = useParams()
  const router = useRouter()
  const venueId = params.venueId as string

  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    logger.info("VENUE_DASHBOARD", "Initializing venue dashboard", { venueId })

    const validatedSession = getValidatedSession()
    if (!validatedSession) {
      logger.warn("VENUE_DASHBOARD", "No valid session found, redirecting to sign-in")
      router.push("/sign-in")
      return
    }

    if (validatedSession.venue.venue_id !== venueId) {
      logger.warn("VENUE_DASHBOARD", "Session venue mismatch", {
        sessionVenueId: validatedSession.venue.venue_id,
        requestedVenueId: venueId,
      })
      router.push(`/dashboard/${validatedSession.venue.venue_id}`)
      return
    }

    logger.info("VENUE_DASHBOARD", "Session validated successfully", {
      userId: validatedSession.user.id,
      venueId: validatedSession.venue.venue_id,
    })
    setSession(validatedSession)
    setLoading(false)
  }, [venueId, router])

  const handleSignOut = async () => {
    await signOutUser()
    setSession(null)
    router.push("/")
  }

  const orderPageUrl = `${window.location.origin}/order?venue=${venueId}&table=1`
  const qrCodeUrl = `${window.location.origin}/generate-qr?venue=${venueId}`

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 mx-auto text-gray-400 animate-spin mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Session expired. Please sign in again.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{session.venue.name}</h1>
                <p className="text-sm text-gray-600">
                  {session.venue.business_type} • {session.user.name}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{venueId}</Badge>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ExternalLink className="mr-2 h-5 w-5" />
                Customer Order Page
              </CardTitle>
              <CardDescription>Direct link for customers to place orders</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <code className="text-sm break-all">{orderPageUrl}</code>
                </div>
                <Button onClick={() => window.open(orderPageUrl, "_blank")} className="w-full" variant="outline">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Order Page
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <QrCode className="mr-2 h-5 w-5" />
                QR Code Generator
              </CardTitle>
              <CardDescription>Generate QR codes for table ordering</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.open(qrCodeUrl, "_blank")} className="w-full">
                <QrCode className="mr-2 h-4 w-4" />
                Generate QR Codes
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">Live Orders</TabsTrigger>
            <TabsTrigger value="menu">Menu Management</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <LiveOrders venueId={venueId} session={session} />
          </TabsContent>

          <TabsContent value="menu">
            <MenuManagement venueId={venueId} session={session} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
