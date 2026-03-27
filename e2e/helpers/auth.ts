import { createAdminClient } from './test-data';

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from('push_subscriptions').delete().eq('user_id', userId);
  await admin.from('completions').delete().eq('user_id', userId);
  await admin.from('tasks').delete().eq('user_id', userId);
  await admin.from('habits').delete().eq('user_id', userId);
  await admin.auth.admin.deleteUser(userId);
}
