const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type CurrencyOptions = {
  compact?: boolean;
  maximumFractionDigits?: number;
};

function trimTrailingZeroes(value: string) {
  return value.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatINR(value: string | number | null | undefined, options: CurrencyOptions = {}) {
  const amount = Number(value ?? 0);
  const absAmount = Math.abs(amount);
  const maximumFractionDigits = options.maximumFractionDigits ?? 0;

  if (options.compact !== false && absAmount >= 10_000_000) {
    const crore = trimTrailingZeroes((amount / 10_000_000).toFixed(1));
    return `₹\u00A0${crore} Crore`;
  }

  if (options.compact !== false && absAmount >= 100_000) {
    const lakh = trimTrailingZeroes((amount / 100_000).toFixed(1));
    return `₹\u00A0${lakh} Lakh`;
  }

  return `₹\u00A0${amount.toLocaleString("en-IN", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0
  })}`;
}

export function formatDateShort(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTimeShort(value: string | Date | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${formatDateShort(date)}, ${time}`;
}

export function humanizeConstant(value: string | null | undefined) {
  if (!value) return "";
  const trimmed = value.trim();

  if (!/^[A-Z0-9_\s-]+$/.test(trimmed)) return trimmed;

  const words = trimmed
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return trimmed;
  return words.map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word)).join(" ");
}

export function maskPhoneNumber(value: string | null | undefined) {
  if (!value) return "-";

  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return value;

  const visibleStart = digits.length > 10 ? digits.length - 10 : 0;
  const countryCode = visibleStart > 0 ? `+${digits.slice(0, visibleStart)} ` : "";
  const local = digits.slice(visibleStart);
  const first = local.slice(0, 2);
  const last = local.slice(-2);
  const masked = "*".repeat(Math.max(0, local.length - 4));

  return `${countryCode}${first}${masked}${last}`;
}

export function truncateText(value: string | null | undefined, maxLength = 80) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}
