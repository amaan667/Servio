import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface QuickAction {

}

interface QuickActionCardProps {

}

export function QuickActionCard({ title, actions }: QuickActionCardProps) {
  return (
    <Card className="shadow-lg rounded-xl border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                asChild
                variant={action.variant || "outline"}
                className="justify-start h-auto py-3 px-4 hover:shadow-md transition-shadow"
              >
                <Link href={action.href}>
                  <Icon className="h-5 w-5 mr-2" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{action.label}</span>
                    {action.description && (
                      <span className="text-xs text-muted-foreground">{action.description}</span>
                    )}
                  </div>
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
