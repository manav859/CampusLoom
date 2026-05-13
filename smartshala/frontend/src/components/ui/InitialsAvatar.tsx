type InitialsAvatarProps = {
  name: string;
  size?: "sm" | "md";
};

const palette = [
  "bg-[#E2F0FB] text-[#1F6FB8]",
  "bg-[#E1F5EA] text-[#0F8A4A]",
  "bg-[#FFF2DC] text-[#B95A00]",
  "bg-[#FCE3E5] text-[#C8242C]",
  "bg-[#EEE7FF] text-[#7C3AED]"
];

const sizeClass: Record<NonNullable<InitialsAvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-[12px]"
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function colorIndex(name: string) {
  return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
}

export function InitialsAvatar({ name, size = "md" }: InitialsAvatarProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClass[size]} ${palette[colorIndex(name)]}`}>
      {initials(name)}
    </span>
  );
}
