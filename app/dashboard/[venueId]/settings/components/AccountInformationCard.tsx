import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail } from "lucide-react";
import { User as UserType } from "../hooks/useVenueSettings";

interface AccountInformationCardProps {
  user: UserType;
}

export function AccountInformationCard({ user }: AccountInformationCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <User className="h-5 w-5 text-purple-600" />
          Account Information
        </CardTitle>
        <CardDescription>Your personal account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label htmlFor="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Address
          </Label>
          <Input
            id="email"
            type="email"
            value={user.email}
            disabled
            className="bg-gray-50 border-gray-200 rounded-lg mt-1"
          />
          <p className="text-sm text-gray-600 mt-1">
            Email address cannot be changed - it's associated with your Gmail account
          </p>
        </div>

        <div>
          <Label htmlFor="fullName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Full Name
          </Label>
          <Input
            id="fullName"
            value={user.user_metadata?.full_name || ""}
            disabled
            className="bg-gray-50 border-gray-200 rounded-lg mt-1"
          />
        </div>
      </CardContent>
    </Card>
  );
}
