import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2026-06-24.dahlia',
});

/**
 * Creates a Stripe product and a payment link for a custom travel package.
 * Returns the created Product ID, Price ID, and Payment Link URL.
 */
export async function createStripePackageLink({
  title,
  description,
  retailPriceCents,
}: {
  title: string;
  description: string;
  retailPriceCents: number;
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[stripe] STRIPE_SECRET_KEY is missing. Returning a mock payment link.');
    return {
      productId: 'prod_mock',
      priceId: 'price_mock',
      paymentLink: 'https://buy.stripe.com/mock_link',
    };
  }

  try {
    // 1. Create the Product
    const product = await stripe.products.create({
      name: title,
      description: description,
    });

    // 2. Create the Price
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: retailPriceCents,
      currency: 'usd',
    });

    // 3. Create the Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/itinerary?success=true`,
        },
      },
    });

    return {
      productId: product.id,
      priceId: price.id,
      paymentLink: paymentLink.url,
    };
  } catch (err) {
    console.error('[stripe] Error creating package link:', err);
    throw err;
  }
}
