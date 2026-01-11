import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Smartphone, Clock, CreditCard, BarChart3, Users } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {

    },
    {

      description:
        "Beautiful, responsive interface optimized for mobile devices. Your customers will love the smooth ordering experience.",

    },
    {

    },
    {

    },
    {

      description:
        "Detailed analytics on sales, popular items, and customer behavior to help you make data-driven decisions.",

    },
    {

      description:
        "Manage your team with role-based access. Kitchen staff, front-of-house, and managers each get the tools they need.",

    },
  ];

  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Run Your Food Business
          </h2>
          <p className="text-xl text-gray-800 max-w-3xl mx-auto">
            From QR code ordering to kitchen management and inventory, Servio provides all the tools
            you need to streamline operations and serve customers efficiently.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const colorClasses = {

            };

            return (
              <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-8">
                  <div
                    className={`w-12 h-12 ${colorClasses[feature.color as keyof typeof colorClasses]} rounded-lg flex items-center justify-center mb-6`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">{feature.title}</h3>
                  <p className="text-gray-800">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
