// MilesBot's WhatsApp number, set via VITE_MILESBOT_WHATSAPP in international
// format (e.g. 12815551234 or +1 281 555 1234). When it isn't set, the "Text
// MilesBot" buttons are hidden rather than pointing at a number that doesn't
// exist.
const digits = String(import.meta.env.VITE_MILESBOT_WHATSAPP ?? '').replace(/\D/g, '');

export const milesBotChatUrl: string | null = digits ? `https://wa.me/${digits}` : null;
