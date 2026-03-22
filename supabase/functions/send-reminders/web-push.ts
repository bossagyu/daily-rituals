// supabase/functions/send-reminders/web-push.ts
// Web Push sending using the web-push npm package via Deno's npm: specifier.

import webpush from 'npm:web-push@3';

type Subscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

let vapidConfigured = false;

function ensureVapidConfigured(vapidKeys: VapidKeys): void {
  if (!vapidConfigured) {
    webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);
    vapidConfigured = true;
  }
}

export async function sendWebPush(
  subscription: Subscription,
  payload: string,
  vapidKeys: VapidKeys,
): Promise<void> {
  ensureVapidConfigured(vapidKeys);

  const result = await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    payload,
  );

  console.log(
    `Push response: ${result.statusCode} (endpoint: ${subscription.endpoint.substring(0, 50)}...)`,
  );

  if (result.statusCode >= 400) {
    throw new Error(`Push failed: ${result.statusCode} ${result.body}`);
  }
}
