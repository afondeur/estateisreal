// In-memory rate limiter using a Map of IP → timestamps
const hits = new Map();

/**
 * @param {string} ip - Client IP address
 * @param {number} limit - Max requests allowed in window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number }}
 */
export function rateLimit(ip, limit, windowMs) {
  const now = Date.now();
  const key = ip || "unknown";

  if (!hits.has(key)) {
    hits.set(key, []);
  }

  const timestamps = hits.get(key).filter((t) => now - t < windowMs);
  hits.set(key, timestamps);

  if (timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  timestamps.push(now);
  return { allowed: true, remaining: limit - timestamps.length };
}
