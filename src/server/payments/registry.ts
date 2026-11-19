import crypto from 'crypto';

export type SupportedProviderId =
  | 'paystack'
  | 'flutterwave'
  | 'stripe'
  | 'bank_transfer'
  | 'cash_on_delivery';

export interface GatewayCredentials {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  mode: 'test' | 'live';
  config: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    instructions?: string;
    eligibleStates?: string[];
    additionalFee?: number;
  };
}

export interface InitializePaymentInput {
  orderNumber: string;
  reference: string;
  amountNgn: number;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  callbackUrl: string;
  credentials: GatewayCredentials;
}

export interface InitializePaymentResult {
  authorizationUrl?: string;
  providerReference?: string;
  instructions?: string;
  requiresRedirect: boolean;
  raw?: Record<string, unknown>;
}

export interface VerifyPaymentResult {
  verified: boolean;
  status: 'paid' | 'pending' | 'failed';
  amountNgn: number;
  reference: string;
  providerPayload: Record<string, unknown>;
  message: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface PaymentProviderAdapter {
  id: SupportedProviderId;
  name: string;
  kind: 'online' | 'manual' | 'cod';
  description: string;
  supportsWebhook: boolean;
  supportsRefunds: boolean;
  testConnection(creds: GatewayCredentials): Promise<ConnectionTestResult>;
  initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult>;
  verifyTransaction(
    reference: string,
    creds: GatewayCredentials,
    expectedAmountNgn?: number
  ): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    creds: GatewayCredentials
  ): boolean;
}

const paystackAdapter: PaymentProviderAdapter = {
  id: 'paystack',
  name: 'Paystack',
  kind: 'online',
  description: 'Cards, Bank Transfers, USSD & Apple Pay via Paystack Nigeria.',
  supportsWebhook: true,
  supportsRefunds: true,

  async testConnection(creds) {
    if (!creds.secretKey) {
      return { ok: false, message: 'Paystack Secret Key is required.' };
    }
    try {
      const resp = await fetch('https://api.paystack.co/balance', {
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
        },
      });
      const data = (await resp.json()) as { status?: boolean; message?: string };
      if (resp.ok && data.status) {
        return { ok: true, message: 'Connected to Paystack API successfully.' };
      }
      return {
        ok: false,
        message: data.message || `Paystack rejected credentials (HTTP ${resp.status}).`,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: `Network error contacting Paystack: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },

  async initializePayment(input) {
    if (!input.credentials.secretKey) {
      throw new Error('Paystack is not configured with a valid secret key.');
    }
    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.credentials.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.customerEmail,
        amount: Math.round(input.amountNgn * 100), // kobo
        reference: input.reference,
        callback_url: input.callbackUrl,
        currency: 'NGN',
        metadata: {
          orderNumber: input.orderNumber,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
        },
      }),
    });
    const data = (await resp.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    };
    if (!resp.ok || !data.status || !data.data?.authorization_url) {
      throw new Error(data.message || 'Unable to initialize Paystack transaction.');
    }
    return {
      authorizationUrl: data.data.authorization_url,
      providerReference: data.data.reference || input.reference,
      requiresRedirect: true,
      raw: data as unknown as Record<string, unknown>,
    };
  },

  async verifyTransaction(reference, creds, expectedAmountNgn) {
    if (!creds.secretKey) {
      return {
        verified: false,
        status: 'failed',
        amountNgn: 0,
        reference,
        providerPayload: {},
        message: 'Paystack secret key missing.',
      };
    }
    const resp = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
        },
      }
    );
    const data = (await resp.json()) as {
      status?: boolean;
      message?: string;
      data?: { status?: string; amount?: number; reference?: string };
    };
    if (!resp.ok || !data.status || !data.data) {
      return {
        verified: false,
        status: 'failed',
        amountNgn: 0,
        reference,
        providerPayload: (data as unknown as Record<string, unknown>) || {},
        message: data.message || 'Paystack verification failed.',
      };
    }
    const paidNgn = Math.round((data.data.amount || 0) / 100);
    const isSuccess = data.data.status === 'success';
    const amountMatches =
      expectedAmountNgn === undefined || paidNgn >= expectedAmountNgn;
    return {
      verified: isSuccess && amountMatches,
      status: isSuccess && amountMatches ? 'paid' : 'failed',
      amountNgn: paidNgn,
      reference: data.data.reference || reference,
      providerPayload: data.data as unknown as Record<string, unknown>,
      message:
        isSuccess && amountMatches
          ? 'Payment verified with Paystack.'
          : 'Payment amount or status mismatch on Paystack.',
    };
  },

  verifyWebhookSignature(rawBody, headers, creds) {
    const sig = headers['x-paystack-signature'];
    const secret = creds.webhookSecret || creds.secretKey;
    if (!sig || typeof sig !== 'string' || !secret) return false;
    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(sig));
    } catch {
      return false;
    }
  },
};

const flutterwaveAdapter: PaymentProviderAdapter = {
  id: 'flutterwave',
  name: 'Flutterwave',
  kind: 'online',
  description: 'Cards, Mobile Money, Barter & Bank Transfer via Flutterwave v3.',
  supportsWebhook: true,
  supportsRefunds: true,

  async testConnection(creds) {
    if (!creds.secretKey) {
      return { ok: false, message: 'Flutterwave Secret Key is required.' };
    }
    try {
      const resp = await fetch('https://api.flutterwave.com/v3/balances', {
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
        },
      });
      const data = (await resp.json()) as { status?: string; message?: string };
      if (resp.ok && data.status === 'success') {
        return { ok: true, message: 'Connected to Flutterwave API successfully.' };
      }
      return {
        ok: false,
        message: data.message || `Flutterwave rejected credentials (HTTP ${resp.status}).`,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: `Network error contacting Flutterwave: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },

  async initializePayment(input) {
    if (!input.credentials.secretKey) {
      throw new Error('Flutterwave secret key is not configured.');
    }
    const resp = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.credentials.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: input.reference,
        amount: input.amountNgn,
        currency: 'NGN',
        redirect_url: input.callbackUrl,
        customer: {
          email: input.customerEmail,
          phonenumber: input.customerPhone,
          name: input.customerName,
        },
        customizations: {
          title: 'DIAMOND STORE',
          description: `Order ${input.orderNumber}`,
        },
      }),
    });
    const data = (await resp.json()) as {
      status?: string;
      message?: string;
      data?: { link?: string };
    };
    if (!resp.ok || data.status !== 'success' || !data.data?.link) {
      throw new Error(data.message || 'Unable to initialize Flutterwave payment.');
    }
    return {
      authorizationUrl: data.data.link,
      providerReference: input.reference,
      requiresRedirect: true,
      raw: data as unknown as Record<string, unknown>,
    };
  },

  async verifyTransaction(reference, creds, expectedAmountNgn) {
    if (!creds.secretKey) {
      return {
        verified: false,
        status: 'failed',
        amountNgn: 0,
        reference,
        providerPayload: {},
        message: 'Flutterwave secret key missing.',
      };
    }
    const resp = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
        },
      }
    );
    const data = (await resp.json()) as {
      status?: string;
      message?: string;
      data?: { status?: string; amount?: number; tx_ref?: string; currency?: string };
    };
    if (!resp.ok || data.status !== 'success' || !data.data) {
      return {
        verified: false,
        status: 'failed',
        amountNgn: 0,
        reference,
        providerPayload: (data as unknown as Record<string, unknown>) || {},
        message: data.message || 'Flutterwave verification failed.',
      };
    }
    const paidNgn = Math.round(Number(data.data.amount || 0));
    const isSuccess = data.data.status === 'successful';
    const amountMatches =
      expectedAmountNgn === undefined || paidNgn >= expectedAmountNgn;
    return {
      verified: isSuccess && amountMatches,
      status: isSuccess && amountMatches ? 'paid' : 'failed',
      amountNgn: paidNgn,
      reference: data.data.tx_ref || reference,
      providerPayload: data.data as unknown as Record<string, unknown>,
      message:
        isSuccess && amountMatches
          ? 'Payment verified with Flutterwave.'
          : 'Flutterwave transaction verification failed.',
    };
  },

  verifyWebhookSignature(_rawBody, headers, creds) {
    const hash = headers['verif-hash'];
    const secret = creds.webhookSecret;
    if (!hash || typeof hash !== 'string' || !secret) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(secret));
    } catch {
      return false;
    }
  },
};

const stripeAdapter: PaymentProviderAdapter = {
  id: 'stripe',
  name: 'Stripe',
  kind: 'online',
  description: 'International Visa, Mastercard, Amex & Apple Pay via Stripe Checkout.',
  supportsWebhook: true,
  supportsRefunds: true,

  async testConnection(creds) {
    if (!creds.secretKey) {
      return { ok: false, message: 'Stripe Secret Key is required.' };
    }
    try {
      const resp = await fetch('https://api.stripe.com/v1/balance', {
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
        },
      });
      if (resp.ok) {
        return { ok: true, message: 'Connected to Stripe API successfully.' };
      }
      const data = (await resp.json()) as { error?: { message?: string } };
      return {
        ok: false,
        message: data.error?.message || `Stripe rejected credentials (HTTP ${resp.status}).`,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        message: `Network error contacting Stripe: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  },

  async initializePayment(input) {
    if (!input.credentials.secretKey) {
      throw new Error('Stripe secret key is not configured.');
    }
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', `${input.callbackUrl}&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', input.callbackUrl);
    params.append('customer_email', input.customerEmail);
    params.append('client_reference_id', input.reference);
    params.append('line_items[0][price_data][currency]', 'ngn');
    params.append(
      'line_items[0][price_data][product_data][name]',
      `DIAMOND STORE Order ${input.orderNumber}`
    );
    params.append(
      'line_items[0][price_data][unit_amount]',
      String(Math.round(input.amountNgn * 100))
    );
    params.append('line_items[0][quantity]', '1');

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.credentials.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = (await resp.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };
    if (!resp.ok || !data.url || !data.id) {
      throw new Error(data.error?.message || 'Unable to initialize Stripe Checkout.');
    }
    return {
      authorizationUrl: data.url,
      providerReference: data.id,
      requiresRedirect: true,
      raw: data as unknown as Record<string, unknown>,
    };
  },

  async verifyTransaction(reference, creds, expectedAmountNgn) {
    if (!creds.secretKey) {
      return {
        verified: false,
        status: 'failed',
        amountNgn: 0,
        reference,
        providerPayload: {},
        message: 'Stripe secret key missing.',
      };
    }
    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${creds.secretKey}`,
        },
      }
    );
    const data = (await resp.json()) as {
      payment_status?: string;
      amount_total?: number;
      id?: string;
      error?: { message?: string };
    };
    if (!resp.ok || data.error) {
      return {
        verified: false,
        status: 'failed',
        amountNgn: 0,
        reference,
        providerPayload: (data as unknown as Record<string, unknown>) || {},
        message: data.error?.message || 'Stripe verification failed.',
      };
    }
    const paidNgn = Math.round((data.amount_total || 0) / 100);
    const isSuccess = data.payment_status === 'paid';
    const amountMatches =
      expectedAmountNgn === undefined || paidNgn >= expectedAmountNgn;
    return {
      verified: isSuccess && amountMatches,
      status: isSuccess && amountMatches ? 'paid' : 'pending',
      amountNgn: paidNgn,
      reference: data.id || reference,
      providerPayload: data as unknown as Record<string, unknown>,
      message:
        isSuccess && amountMatches
          ? 'Payment verified with Stripe.'
          : 'Stripe session not yet paid.',
    };
  },

  verifyWebhookSignature(rawBody, headers, creds) {
    const sigHeader = headers['stripe-signature'];
    const secret = creds.webhookSecret;
    if (!sigHeader || typeof sigHeader !== 'string' || !secret) return false;
    const parts = sigHeader.split(',').reduce<Record<string, string>>((acc, item) => {
      const [k, v] = item.split('=');
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    if (!parts.t || !parts.v1) return false;
    const signedPayload = `${parts.t}.${rawBody.toString()}`;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
    } catch {
      return false;
    }
  },
};

const bankTransferAdapter: PaymentProviderAdapter = {
  id: 'bank_transfer',
  name: 'Direct Bank Transfer',
  kind: 'manual',
  description: 'Direct NGN transfer to DIAMOND STORE corporate bank account with manual admin confirmation.',
  supportsWebhook: false,
  supportsRefunds: false,

  async testConnection(creds) {
    if (!creds.config.bankName || !creds.config.accountNumber || !creds.config.accountName) {
      return {
        ok: false,
        message: 'Bank name, account name, and account number are required.',
      };
    }
    return {
      ok: true,
      message: `Bank details verified (${creds.config.bankName} — ${creds.config.accountNumber}).`,
    };
  },

  async initializePayment(input) {
    return {
      requiresRedirect: false,
      providerReference: input.reference,
      instructions:
        input.credentials.config.instructions ||
        `Transfer ₦${input.amountNgn.toLocaleString()} to ${input.credentials.config.bankName || 'our bank account'} (${input.credentials.config.accountNumber || ''}) using reference ${input.orderNumber}.`,
    };
  },

  async verifyTransaction(reference, _creds, expectedAmountNgn) {
    return {
      verified: false,
      status: 'pending',
      amountNgn: expectedAmountNgn || 0,
      reference,
      providerPayload: { manualReviewRequired: true },
      message: 'Awaiting manual bank transfer confirmation by administrator.',
    };
  },

  verifyWebhookSignature() {
    return false;
  },
};

const codAdapter: PaymentProviderAdapter = {
  id: 'cash_on_delivery',
  name: 'Cash on Delivery',
  kind: 'cod',
  description: 'Pay by cash or POS terminal upon delivery in eligible states.',
  supportsWebhook: false,
  supportsRefunds: false,

  async testConnection() {
    return {
      ok: true,
      message: 'Cash on Delivery module active.',
    };
  },

  async initializePayment(input) {
    return {
      requiresRedirect: false,
      providerReference: input.reference,
      instructions: 'Pay via POS or Cash on Delivery when your courier arrives.',
    };
  },

  async verifyTransaction(reference, _creds, expectedAmountNgn) {
    return {
      verified: false,
      status: 'pending',
      amountNgn: expectedAmountNgn || 0,
      reference,
      providerPayload: { cod: true },
      message: 'Payment collected upon delivery.',
    };
  },

  verifyWebhookSignature() {
    return false;
  },
};

export const PAYMENT_ADAPTERS: Record<SupportedProviderId, PaymentProviderAdapter> = {
  paystack: paystackAdapter,
  flutterwave: flutterwaveAdapter,
  stripe: stripeAdapter,
  bank_transfer: bankTransferAdapter,
  cash_on_delivery: codAdapter,
};

export function getPaymentAdapter(provider: string): PaymentProviderAdapter | null {
  return PAYMENT_ADAPTERS[provider as SupportedProviderId] || null;
}

export function listAvailableProviders() {
  return Object.values(PAYMENT_ADAPTERS).map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    description: a.description,
    supportsWebhook: a.supportsWebhook,
    supportsRefunds: a.supportsRefunds,
  }));
}
