"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ExternalLink } from "lucide-react"

export function DatabaseConnectionError() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-red-500 h-6 w-6" />
            Database Connection Error
          </CardTitle>
          <CardDescription>The application cannot connect to the database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Supabase Environment Variables Are Missing</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                This application requires a connection to a Supabase project to function correctly. The necessary
                Supabase credentials are missing from your environment configuration.
              </p>
              <p>
                If you are running this project on Vercel, the easiest way to fix this is by adding the Supabase
                integration to your project.
              </p>
            </AlertDescription>
          </Alert>
          <a
            href="https://vercel.com/integrations/supabase"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full"
          >
            <Button className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Add Supabase Integration on Vercel
            </Button>
          </a>
          <div className="text-xs text-gray-500">
            <p className="font-semibold">Running locally?</p>
            <p>
              Create a <code>.env.local</code> file in your project's root directory and add your Supabase credentials.
              Check the Supabase documentation for the required environment variables.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
