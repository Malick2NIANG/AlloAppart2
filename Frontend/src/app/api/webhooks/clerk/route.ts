import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  let event: WebhookEvent;
  try {
    event = await verifyWebhook(req);
  } catch {
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 });
  }

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { id: clerkId, email_addresses, first_name, last_name, phone_numbers } = event.data;
    const email = email_addresses[0]?.email_address;
    const phone = phone_numbers?.[0]?.phone_number;

    if (!email) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerkId,
        email,
        firstName: first_name ?? '',
        lastName: last_name ?? '',
        phone,
      }),
    });
  }

  return NextResponse.json({ received: true });
}
