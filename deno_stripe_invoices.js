// import Stripe from 'https://esm.sh/stripe@12.3.0?target=deno&no-check';
// import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
import { config } from 'https://deno.land/x/dotenv/mod.ts';
import Stripe from "npm:stripe@^11.16";

// await load();
// Load environment variables from .env file
const env=config();

// Access your environment variables
const STRIPE_API_KEY = env.STRIPE_API_KEY || Deno.env.get('STRIPE_API_KEY');;

const stripe = new Stripe(STRIPE_API_KEY, {
    apiVersion: '2022-11-15',
});

async function findOrCreateCustomer(email, name) {
    // Check if the customer already exists
    const customers = await stripe.customers.list({
        email,
        limit: 1,
    });

    if (customers.data.length > 0) {
        return customers.data[0];
    } else {
        // If not found, create a new customer
        const customer = await stripe.customers.create({
            email,
            name,
        });
        return customer;
    }
}

export async function createInvoiceForCustomer(email, name, amount, description) {
    // 1. Find or create the customer
    const customer = await findOrCreateCustomer(email, name);

    // 2. Create a draft invoice with collection_method set to 'send_invoice'
    const invoice = await stripe.invoices.create({
        customer: customer.id,
        collection_method: 'send_invoice',
        days_until_due: 7, // Set the number of days until the invoice is due
    });

    // 3. Add the invoice item with the specified amount
    await stripe.invoiceItems.create({
        customer: customer.id,
        amount,
        currency: 'usd',
        description,
        invoice: invoice.id, // Associate the item with the draft invoice
    });

    // 4. Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    // 5. Send the invoice email to the customer
    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);

    return sentInvoice;
}

// // Example usage
// createInvoiceForCustomer(
//     'mehdi2neggazi@gmail.com', // Customer's email
//     'Mehdi Neggazi', // Customer's name
//     2400, // Amount in cents (i.e., $24.00)
//     'API service' // Description for the line item
// ).then(invoice => {
//     console.log('Invoice created and sent:', invoice);
// }).catch(error => {
//     console.error('Error creating or sending invoice:', error);
// });
