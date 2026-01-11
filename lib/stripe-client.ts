import Stripe from "stripe";

// Lazy initialize Stripe client
let stripeInstance: Stripe | null = null;

export function getStripeClient() {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {

  }
  return stripeInstance;
}

// Export for backward compatibility with direct usage
export const stripe = new Proxy(
  {
    /* Empty */
  } as Stripe,
  {
    get(_target, prop) {
      return getStripeClient()[prop as keyof Stripe];
    },
  }
);
