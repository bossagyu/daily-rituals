const MAX_DISPLAY = 3;

export function buildNotificationBody(habitNames: readonly string[]): string {
  if (habitNames.length === 0) {
    return '';
  }

  const displayed = habitNames.slice(0, MAX_DISPLAY).map((n) => `「${n}」`).join('');
  const remaining = habitNames.length - MAX_DISPLAY;
  const suffix = remaining > 0 ? `他${remaining}件` : '';

  return `${displayed}${suffix}がまだ完了していません`;
}
