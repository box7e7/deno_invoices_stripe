import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { config } from 'https://deno.land/x/dotenv/mod.ts';
// import {createInvoiceForCustomer} from './deno_stripe_invoices.js'


// Dynamically import the `deno_stripe_invoices.js` module
const { createInvoiceForCustomer } = await import('./deno_stripe_invoices.js');

// Load environment variables from .env file
const env=config();

// Access your environment variables
const supabaseUrl = env.SUPABASE_URL || Deno.env.get('SUPABASE_URL');
const supabaseKey = env.SUPABASE_KEY || Deno.env.get('SUPABASE_KEY');

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,  // Set a rate limit for real-time events
    },
  },
});

const channels = supabase.channel('custom-update-channel')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'invoices' },
    (payload) => {
      console.log('New received!', payload.new);
      console.log('Old received!', payload.old);
    }
  )
  .subscribe();

const channels_1 = supabase.channel('custom-insert-channel')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'invoices' },
    async (payload) => {
      console.log('Change received!', payload);

      let email=payload.new.email
      let name=payload.new.name
      let amount=payload.new.items[0].amount
      let description=payload.new.items[0].description

      try {
  
        // Create an invoice for the customer
        const invoice = await createInvoiceForCustomer(email, name, amount, description);
        console.log('Invoice created:', invoice);

        // Update the `invoices` table with the `invoice_id`
        const invoiceId = invoice.id; // Assuming the `invoice` object has an `id` property
        const hosted_invoice_url=invoice.hosted_invoice_url
        const invoice_pdf=invoice.invoice_pdf

        const { data, error } = await supabase
          .from('invoices')
          .update({ stripeInvoiceId: invoiceId, stripeInvoiceUrl:hosted_invoice_url, stripeInvoicePdf:invoice_pdf,stripeInvoiceStatus:"draft" }) // Update with the new invoice_id
          .eq('id', payload.new.id); // Match the row using the `id` from the payload

        if (error) {
          console.error('Error updating invoice:', error);
        } else {
          console.log('Invoice updated with invoice_id:', data);
        }
      } catch (error) {
        console.error('Error creating or sending invoice:', error);
      }
    }

    
  )
  .subscribe();

// Fetch the first row from the 'roadside' table
async function getFirstRow() {
  const { data, error } = await supabase
    .from('invoices')
    .select('*') // Select all columns
    .limit(2);   // Limit the result to 2 rows

  if (error) {
    console.error('Error fetching data:', error);
  } else {
    console.log('First row:', data);
  }
}

getFirstRow();
