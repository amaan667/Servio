import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building, Mail, Phone, MapPin, Globe, Utensils, MapPinned } from "lucide-react";
import { TIMEZONES, VENUE_TYPES, SERVICE_TYPES } from "../constants";
import type { LocaleInfo } from "@/lib/locale";

interface VenueSettingsCardProps {
  venueName: string;
  setVenueName: (name: string) => void;
  venueEmail: string;
  setVenueEmail: (email: string) => void;
  venuePhone: string;
  setVenuePhone: (phone: string) => void;
  venueAddress: string;
  setVenueAddress: (address: string) => void;
  country: string;
  setCountry: (country: string) => void;
  countryOptions: LocaleInfo[];
  applyCountryLocale: (countryCode: string) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  venueType: string;
  setVenueType: (type: string) => void;
  serviceType: string;
  setServiceType: (type: string) => void;
  latitude?: number;
  setLatitude: (lat: number | undefined) => void;
  longitude?: number;
  setLongitude: (lng: number | undefined) => void;
}

export function VenueSettingsCard({
  venueName,
  setVenueName,
  venueEmail,
  setVenueEmail,
  venuePhone,
  setVenuePhone,
  venueAddress,
  setVenueAddress,
  country,
  setCountry,
  countryOptions,
  applyCountryLocale,
  timezone,
  setTimezone,
  currency,
  setCurrency,
  venueType,
  setVenueType,
  serviceType,
  setServiceType,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
}: VenueSettingsCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
        <CardTitle className="flex items-center gap-2 text-gray-900">
          <Building className="h-5 w-5 text-purple-600" />
          Venue Settings
        </CardTitle>
        <CardDescription>Configure your venue details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div>
          <Label htmlFor="venueName" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            Venue Name *
          </Label>
          <Input
            id="venueName"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Enter venue name"
            className="rounded-lg mt-1"
          />
        </div>

        <div>
          <Label htmlFor="venueEmail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Venue Email
          </Label>
          <Input
            id="venueEmail"
            type="email"
            value={venueEmail}
            onChange={(e) => setVenueEmail(e.target.value)}
            placeholder="venue@example.com"
            className="rounded-lg mt-1"
          />
        </div>

        <div>
          <Label htmlFor="venuePhone" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Venue Phone
          </Label>
          <Input
            id="venuePhone"
            type="tel"
            value={venuePhone}
            onChange={(e) => setVenuePhone(e.target.value)}
            placeholder="+44 20 1234 5678"
            className="rounded-lg mt-1"
          />
        </div>

        <div>
          <Label htmlFor="venueAddress" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Venue Address
          </Label>
          <Input
            id="venueAddress"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            placeholder="123 Main Street, City, Country"
            className="rounded-lg mt-1"
          />
        </div>

        <div>
          <Label htmlFor="country" className="flex items-center gap-2">
            <MapPinned className="h-4 w-4" />
            Country / Region
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">
            Currency and timezone are auto-detected from your country. Change country here if needed.
          </p>
          <Select
            value={country || "auto"}
            onValueChange={(v) => {
              if (v === "auto") {
                setCountry("");
              } else {
                applyCountryLocale(v);
              }
            }}
          >
            <SelectTrigger className="rounded-lg mt-1 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <SelectValue placeholder="Auto (from browser)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (from browser)</SelectItem>
              {countryOptions.map((opt) => (
                <SelectItem key={opt.countryCode} value={opt.countryCode}>
                  {opt.countryName} ({opt.currency}, {opt.timezone})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="currency" className="flex items-center gap-2">
              Currency
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Auto-detected from country</p>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="rounded-lg mt-1 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent>
                {[...new Set([...countryOptions.map((o) => o.currency), currency].filter(Boolean))].sort().map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="timezone" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Timezone
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">Auto-detected from country</p>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="rounded-lg mt-1 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="venueType" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Business Type
            </Label>
            <Select value={venueType} onValueChange={setVenueType}>
              <SelectTrigger className="rounded-lg mt-1 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
              <SelectContent>
                {VENUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="serviceType" className="flex items-center gap-2">
              <Utensils className="h-4 w-4" />
              Service Type
            </Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="rounded-lg mt-1 border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="unknown"
              value={latitude || ""}
              onChange={(e) => setLatitude(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="51.5074"
              className="rounded-lg mt-1"
            />
          </div>

          <div>
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="unknown"
              value={longitude || ""}
              onChange={(e) =>
                setLongitude(e.target.value ? parseFloat(e.target.value) : undefined)
              }
              placeholder="-0.1278"
              className="rounded-lg mt-1"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
