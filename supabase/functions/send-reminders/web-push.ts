// supabase/functions/send-reminders/web-push.ts
// STUB: Replace with actual Web Push implementation
// See RFC 8030 (Web Push Protocol) and RFC 8292 (VAPID)

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
  _vapidKeys: VapidKeys,
): Promise<void> {
  // TODO: Implement VAPID JWT signing and Web Push encryption
  // For now, this is a stub for development/testing
  console.log(`[STUB] Would send push to ${subscription.endpoint}`);
  console.log(`[STUB] Payload: ${payload}`);
}
