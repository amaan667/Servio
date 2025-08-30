'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase/client'

export default function TestAuthImplementation() {
  const [status, setStatus] = useState<string>('Loading...')
  const [user, setUser] = useState<any>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      setStatus('Checking authentication...')
      
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        setError(`Auth error: ${error.message}`)
        setStatus('Error')
        return
      }

      if (session?.user) {
        setUser(session.user)
        setStatus('Authenticated')
      } else {
        setStatus('Not authenticated')
      }
    } catch (err: any) {
      setError(`Exception: ${err.message}`)
      setStatus('Error')
    }
  }

  async function signInWithGoogle() {
    try {
      setStatus('Initiating Google OAuth...')
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: `${window.location.origin}/auth/callback` 
        },
      })

      if (error) {
        setError(`OAuth error: ${error.message}`)
        setStatus('Error')
      } else {
        setStatus('OAuth initiated - check browser redirect')
      }
    } catch (err: any) {
      setError(`Exception: ${err.message}`)
      setStatus('Error')
    }
  }

  async function signOut() {
    try {
      setStatus('Signing out...')
      
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setError(`Sign out error: ${error.message}`)
        setStatus('Error')
      } else {
        setUser(null)
        setStatus('Signed out')
      }
    } catch (err: any) {
      setError(`Exception: ${err.message}`)
      setStatus('Error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-2xl font-bold text-center">Auth Implementation Test</h1>
        
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Status:</h2>
          <p>{status}</p>
        </div>

        {user && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h2 className="font-semibold text-green-800 mb-2">User Info:</h2>
            <p className="text-green-700">Email: {user.email}</p>
            <p className="text-green-700">ID: {user.id}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <p className="font-semibold text-red-800">Error:</p>
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={signInWithGoogle}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            Sign in with Google
          </button>
          
          <button
            onClick={checkAuth}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
          >
            Check Auth Status
          </button>
          
          {user && (
            <button
              onClick={signOut}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
            >
              Sign Out
            </button>
          )}
        </div>

        <div className="text-sm text-gray-600">
          <p>This test verifies:</p>
          <ul className="list-disc list-inside ml-4">
            <li>Supabase client creation</li>
            <li>Session checking</li>
            <li>Google OAuth initiation</li>
            <li>Sign out functionality</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
