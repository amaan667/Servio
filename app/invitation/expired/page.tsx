import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ExpiredInvitationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invitation Expired</h2>
            <p className="text-gray-600 mb-6">
              This invitation has expired. Invitation links are valid for 7 days. Please contact the
              person who invited you for a new invitation.
            </p>
            <Link href="/">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Homepage
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
