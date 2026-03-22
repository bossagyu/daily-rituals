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

export async function sendWebPush(
  subscription: Subscription,
  payload: string,
  vapidKeys: VapidKeys,
): Promise<void> {
  webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);

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

  if (result.statusCode >= 400) {
    throw new Error(`Push failed: ${result.statusCode} ${result.body}`);
  }
}
