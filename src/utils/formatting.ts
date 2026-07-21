/**
 * Formats a number as a USD currency string (e.g., $1,234.56).
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Formats a number of miles with commas and a 'mi' suffix (e.g., 1,234 mi).
 */
export function formatMiles(miles: number): string {
  const formatted = new Intl.NumberFormat('en-US').format(miles);
  return `${formatted} mi`;
}

/**
 * Formats a date string, object, or timestamp to a readable date (e.g., 'May 28, 2026').
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats a date string, object, or timestamp to a short date (e.g., 'May 28').
 */
export function formatShortDate(date: Date | string | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a rate per mile as USD per mile (e.g., $2.34/mi).
 */
export function formatRatePerMile(rate: number): string {
  const formattedRate = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(rate);
  return `${formattedRate}/mi`;
}

/**
 * Extracts the first two letters of a name in uppercase.
 * If the name contains multiple words (first and last), it takes the first letter of each.
 * Otherwise, it takes the first two letters of the single name.
 */
export function getInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

/**
 * Formats a phone number string (e.g., '+12815550001') to '+1 (281) 555-0001'.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Clean all characters except digits and the plus symbol
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Match pattern: optional leading +1 or 1, followed by 10 digits
  const match = cleaned.match(/^(\+1|1)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const intlCode = match[1] ? (match[1].startsWith('+') ? match[1] : `+${match[1]}`) : '+1';
    return `${intlCode} (${match[2]}) ${match[3]}-${match[4]}`;
  }

  return phone;
}

/**
 * Returns a relative time string (e.g., '2 hours ago', '3 days ago', 'just now').
 */
export function timeAgo(date: Date | string | number): string {
  const now = new Date();
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 0) {
    return 'just now';
  }

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}
