"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, User, Building, Mail, Phone } from "lucide-react";

interface Venue {
  venue_id: string;
  name: string;
}



interface User {
  id: string;
  email?: string;
}

interface SettingsClientProps {
  user: User;
  venues: Venue[];
}


export default function SettingsClient({ user, venues }: SettingsClientProps) {
  const [loading, setLoading] = useState(false);
  const [venueForm, setVenueForm] = useState({
    name: venues[0]?.name || '',
    phone: '',
    address: ''
  });
  const [accountForm, setAccountForm] = useState({
    email: user.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const router = useRouter();

  const handleVenueUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // ...venue update logic (should be moved from original)
      alert('Venue settings updated successfully!');
    } catch (error) {
      alert('Error updating venue settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (accountForm.newPassword && accountForm.newPassword !== accountForm.confirmPassword) {
        alert('New passwords do not match');
        return;
      }
      // ...account update logic (should be moved from original)
      alert('Account updated successfully!');
    } catch (error) {
      alert('Error updating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ...existing code for settings UI... */}
      </div>
    </div>
  );
}
