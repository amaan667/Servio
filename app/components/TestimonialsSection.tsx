import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export function TestimonialsSection() {
  const testimonials = [
    {
      quote:
        "Servio transformed our cafe completely. Orders are faster, more accurate, and our customers love the convenience. Revenue is up 30%!",

      role: "Owner, Corner Cafe",

    },
    {
      quote:
        "The setup was incredibly easy. Within an hour, we had QR codes on all our tables. The real-time order management is a game-changer.",

      role: "Manager, Pizza Palace",

    },
    {

      role: "Chef, Bistro 42",

    },
  ];

  return (
    <section id="testimonials" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Loved by Businesses Everywhere</h2>
          <p className="text-xl text-gray-800">See what business owners are saying about Servio</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => {
            const colorClasses = {

            };

            return (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-8">
                  <div className="flex items-center mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-800 mb-6">"{testimonial.quote}"</p>
                  <div className="flex items-center">
                    <div
                      className={`w-12 h-12 ${colorClasses[testimonial.color as keyof typeof colorClasses]} rounded-full flex items-center justify-center mr-4`}
                    >
                      <span className="font-semibold">{testimonial.initials}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{testimonial.author}</p>
                      <p className="text-gray-800">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
