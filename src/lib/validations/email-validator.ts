/**
 * Email validation utility to detect fake, invalid, or disposable email addresses.
 */

// Common disposable / burner email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "guerrillamailblock.com",
  "sharklasers.com",
  "yopmail.com",
  "trashmail.com",
  "throwawaymail.com",
  "dispostable.com",
  "getairmail.com",
  "fake.com",
  "test.com",
  "example.com",
  "burnermail.io",
  "inboxkitten.com",
  "dropmail.me",
  "mohmal.com",
  "mytemp.email",
  "nada.ltd",
  "emailondeck.com",
]);

/**
 * Validates whether an email format is genuine and not from a disposable or fake provider.
 */
export function validateEmailAuthenticity(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email address is required." };
  }

  const normalized = email.trim().toLowerCase();

  // Basic RFC-compliant regex requiring local part, @, domain name, and valid TLD (at least 2 letters)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
  if (!emailRegex.test(normalized)) {
    return {
      isValid: false,
      error: "Please enter a valid email address with a valid domain (e.g. user@gmail.com).",
    };
  }

  const parts = normalized.split("@");
  if (parts.length !== 2) {
    return { isValid: false, error: "Invalid email format." };
  }

  const domain = parts[1];

  // Check if domain is in disposable list
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      error: "Temporary or disposable email addresses are not permitted. Please use a real email provider (like Gmail, Outlook, or Yahoo).",
    };
  }

  // Prevent generic placeholder patterns like user@example or asdf@asdf.com
  if (domain.startsWith("fake") || domain.startsWith("test") || domain.startsWith("sample")) {
    return {
      isValid: false,
      error: "Please provide a genuine email address, not a test or placeholder domain.",
    };
  }

  return { isValid: true };
}
