// Análisis gratuitos por mes calendario (usuarios free). Pro y admin: ilimitados.
export const FREE_MONTHLY_LIMIT = 5;

export function firstOfMonthISO(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// Pro vigente: tier='pro' Y (sin pro_until O pro_until aún en el futuro)
export function hasUnlimitedAccess(profile) {
  if (profile?.is_admin) return true;
  const proNotExpired = !profile?.pro_until ||
    new Date(profile.pro_until).getTime() > Date.now();
  return profile?.tier === "pro" && proNotExpired;
}
