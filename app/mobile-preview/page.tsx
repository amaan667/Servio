"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Smartphone, Scan, ShoppingCart, Clock, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MobilePreview() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-32 py-4">
            <div className="flex items-center">
              <a
                href="https://servio.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="group transition-all duration-300"
              >
                <Image
                  src="/assets/servio-logo-updated.png"
                  alt="Servio Logo"
                  width={768}
                  height={288}
                  className="h-48 w-auto transition-all duration-300 group-hover:scale-105 drop-shadow-md"
                  priority
                />
              </a>
            </div>

            <div className="hidden lg:flex items-center space-x-12">
              <nav className="flex items-center space-x-8">
                <Link href="/" className="text-lg font-medium text-gray-700 hover:text-servio-purple transition-colors">
                  Home
                </Link>
                <Link
                  href="/demo"
                  className="text-lg font-medium text-gray-700 hover:text-servio-purple transition-colors"
                >
                  Demo
                </Link>
                <Link
                  href="/dashboard"
                  className="text-lg font-medium text-gray-700 hover:text-servio-purple transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/generate-qr"
                  className="text-lg font-medium text-gray-700 hover:text-servio-purple transition-colors"
                >
                  QR Generator
                </Link>
              </nav>
              <div className="flex items-center space-x-4">
                <a href="https://servio.uk/sign-in" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-servio-purple text-servio-purple hover:bg-servio-purple hover:text-white bg-transparent text-base px-6 py-2"
                  >
                    Sign In
                  </Button>
                </a>
                <a href="https://servio.uk/get-started" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    className="bg-servio-purple hover:bg-servio-purple-dark text-white text-base px-6 py-2"
                  >
                    Get Started
                  </Button>
                </a>
              </div>
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="relative z-50"
              >
                {isMobileMenuOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile menu overlay */}
        {isMobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="absolute right-0 top-32 w-80 bg-white border-l border-gray-200 shadow-xl h-full">
              <div className="p-6 space-y-6">
                <nav className="space-y-4">
                  <Link
                    href="/"
                    className="block text-xl font-medium text-gray-700 hover:text-servio-purple transition-colors py-3 border-b border-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Home
                  </Link>
                  <Link
                    href="/demo"
                    className="block text-xl font-medium text-gray-700 hover:text-servio-purple transition-colors py-3 border-b border-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Demo
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block text-xl font-medium text-gray-700 hover:text-servio-purple transition-colors py-3 border-b border-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/generate-qr"
                    className="block text-xl font-medium text-gray-700 hover:text-servio-purple transition-colors py-3 border-b border-gray-100"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    QR Generator
                  </Link>
                </nav>
                <div className="space-y-4 pt-4">
                  <a href="https://servio.uk/sign-in" target="_blank" rel="noopener noreferrer" className="block">
                    <Button
                      variant="outline"
                      className="w-full border-servio-purple text-servio-purple hover:bg-servio-purple hover:text-white bg-transparent text-lg py-3"
                    >
                      Sign In
                    </Button>
                  </a>
                  <a href="https://servio.uk/get-started" target="_blank" rel="noopener noreferrer" className="block">
                    <Button className="w-full bg-servio-purple hover:bg-servio-purple-dark text-white text-lg py-3">
                      Get Started
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mobile Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-servio-purple-dark">Customer Experience</CardTitle>
                <p className="text-gray-600">See how customers interact with your menu on their mobile devices.</p>
              </CardHeader>
              <CardContent>
                <div className="mx-auto w-80 h-[600px] bg-gray-900 rounded-3xl p-2 shadow-2xl">
                  <div className="w-full h-full bg-white rounded-2xl overflow-hidden">
                    {/* Mock Mobile Interface */}
                    <div className="bg-servio-purple text-white p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">Café Central</h3>
                          <p className="text-sm opacity-90">Table 5</p>
                        </div>
                        <div className="bg-white/20 px-2 py-1 rounded-full text-xs">3 items</div>
                      </div>
                    </div>

                    <div className="p-4 space-y-4">
                      <div className="flex space-x-2 overflow-x-auto">
                        <div className="bg-servio-purple text-white px-3 py-1 rounded-full text-sm whitespace-nowrap">
                          All
                        </div>
                        <div className="bg-gray-100 px-3 py-1 rounded-full text-sm whitespace-nowrap">Coffee</div>
                        <div className="bg-gray-100 px-3 py-1 rounded-full text-sm whitespace-nowrap">Food</div>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-white border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">Cappuccino</h4>
                              <p className="text-xs text-gray-600">Espresso with steamed milk</p>
                              <p className="text-green-600 font-bold text-sm">£3.25</p>
                            </div>
                            <Button size="sm" className="bg-servio-purple text-xs h-6 px-2">
                              +
                            </Button>
                          </div>
                        </div>

                        <div className="bg-white border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">Avocado Toast</h4>
                              <p className="text-xs text-gray-600">Smashed avocado on sourdough</p>
                              <p className="text-green-600 font-bold text-sm">£6.50</p>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0 text-xs bg-transparent">
                                -
                              </Button>
                              <span className="text-xs">2</span>
                              <Button size="sm" className="bg-servio-purple h-6 w-6 p-0 text-xs">
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-servio-purple text-white p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Total: £16.25</span>
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-servio-purple-dark">Mobile Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Scan className="h-6 w-6 text-servio-purple mt-1" />
                  <div>
                    <h4 className="font-medium">QR Code Scanning</h4>
                    <p className="text-sm text-gray-600">
                      Customers scan table QR codes with their phone camera to instantly access the menu.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <ShoppingCart className="h-6 w-6 text-servio-purple mt-1" />
                  <div>
                    <h4 className="font-medium">Touch-Friendly Interface</h4>
                    <p className="text-sm text-gray-600">
                      Large buttons and intuitive gestures make ordering easy on any screen size.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Clock className="h-6 w-6 text-servio-purple mt-1" />
                  <div>
                    <h4 className="font-medium">Fast Loading</h4>
                    <p className="text-sm text-gray-600">
                      Optimized for mobile networks with quick load times and smooth interactions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-servio-purple-dark">Try It Yourself</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-600">Experience the customer ordering flow on your mobile device.</p>
                <Link href="/order?venue=c9413421-afa4-43d8-b783-3e3235216efa&table=1">
                  <Button className="w-full bg-servio-purple hover:bg-servio-purple-dark">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Open Mobile Demo
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
