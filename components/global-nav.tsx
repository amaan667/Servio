"use client"
import React, { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { signOutUser, getValidatedSession, type AuthSession } from "@/lib/supabase"

export default function GlobalNav() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const isHome = pathname === "/"

  useEffect(() => {
    setSession(getValidatedSession())
  }, [pathname])

  const handleSignOut = async () => {
    await signOutUser()
    setSession(null)
    router.push("/")
  }

  // Responsive nav: show hamburger on mobile
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Nav links config
  const guestLinks = [
    { label: "Home", href: "/" },
    { label: "Features", href: "/#features" },
    { label: "Pricing", href: "/#pricing" },
  ]
  const userLinks = [
    { label: "Home", href: "/" },
    { label: "Dashboard", href: "/dashboard" },
  ]

  return (
    <nav className={`bg-white border-b border-gray-200 sticky top-0 z-50 w-full ${isHome ? "h-40" : "h-20"}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between ${isHome ? "h-40" : "h-20"}`}>
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/servio-logo-updated.png"
            alt="Servio Logo"
            width={isHome ? 4000 : 1600}
            height={isHome ? 1200 : 480}
            className={isHome ? "h-[320px] w-auto md:h-[360px] transition-all duration-200" : "h-[112px] w-auto md:h-[128px] transition-all duration-200"}
            priority
          />
        </Link>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-6">
          {(session ? userLinks : guestLinks).map(link => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-gray-700 hover:text-servio-purple font-medium px-2 py-1 transition-colors ${pathname === link.href || (link.href.startsWith("/#") && isHome) ? "underline underline-offset-4" : ""}`}
            >
              {link.label}
            </Link>
          ))}
          {session ? (
            <>
              <span className="text-gray-500 text-sm px-2">{`Welcome, ${session.user.full_name ? session.user.full_name.split(' ')[0] : session.user.email.split('@')[0]}!`}</span>
              <Button variant="outline" onClick={handleSignOut} className="ml-2 px-4 py-2 text-base">Sign Out</Button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="text-gray-700 hover:text-servio-purple font-medium px-2 py-1 transition-colors">Sign In</Link>
              <Link href="/sign-up" className="ml-2">
                <Button className="bg-servio-purple hover:bg-servio-purple-dark text-white px-5 py-2 rounded-md text-base font-semibold transition-colors shadow">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
        {/* Mobile nav */}
        <div className="md:hidden flex items-center">
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Open menu">
            <svg className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              )}
            </svg>
          </Button>
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-lg z-50">
              <div className="flex flex-col py-4 px-6 space-y-2">
                {(session ? userLinks : guestLinks).map(link => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-gray-700 hover:text-servio-purple font-medium py-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                {session ? (
                  <>
                    <span className="text-gray-500 text-sm py-2">{`Welcome, ${session.user.full_name ? session.user.full_name.split(' ')[0] : session.user.email.split('@')[0]}!`}</span>
                    <Button variant="outline" onClick={() => { setMobileMenuOpen(false); handleSignOut(); }} className="w-full mt-2">Sign Out</Button>
                  </>
                ) : (
                  <>
                    <Link href="/sign-in" className="text-gray-700 hover:text-servio-purple font-medium py-2" onClick={() => setMobileMenuOpen(false)}>Sign In</Link>
                    <Link href="/sign-up" className="block" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full bg-servio-purple hover:bg-servio-purple-dark text-white py-3 rounded-md text-base font-semibold transition-colors shadow mt-2">
                        Get Started
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
} 