export function maskIdentifier(identifier: string): string {
  // Show first 2 chars + *** + last 2 chars
  // e.g. "teacher@school.com" → "te***om"
  //      "9876543210"         → "98***10"
  if (identifier.length <= 4) return "***";
  return (
    identifier.slice(0, 2) +
    "***" +
    identifier.slice(-2)
  );
}
