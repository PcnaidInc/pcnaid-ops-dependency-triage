import { createInvoice as submitInvoice } from '@demo/billing-sdk';
import { formatDate } from '@demo/date-kit';

export function invoiceCustomer(customerId: string) {
  const issuedOn = formatDate(new Date());
  return submitInvoice({ customerId, issuedOn });
}

// This local shadow must NOT be attributed to the billing package.
export function localOnly(submitInvoice: (x: string) => string) {
  return submitInvoice('not-the-sdk');
}
