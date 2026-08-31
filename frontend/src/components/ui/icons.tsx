import type { SVGProps } from "react";

export type IconName =
  | "grid"
  | "wallet"
  | "receipt"
  | "chart"
  | "settings"
  | "chevron-down"
  | "chevron-right"
  | "plus"
  | "arrow-up-right"
  | "arrow-down-right"
  | "transfer"
  | "search"
  | "bell"
  | "menu"
  | "close"
  | "refresh"
  | "shield"
  | "sparkle"
  | "calendar"
  | "upload"
  | "more"
  | "lock"
  | "arrow-left"
  | "users";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export function Icon({ name, ...props }: IconProps) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };

  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H20v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
          <path d="M4 8h13.5a2.5 2.5 0 0 1 2.5 2.5V13h-4a2 2 0 0 0 0 4h4" />
          <path d="M16 15h.01" />
        </svg>
      );
    case "receipt":
      return (
        <svg {...common}>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h17" />
          <path d="m7 15 3-4 3 2 5-7" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
          <path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.9 1.9 0 0 0-3.2 1.4v.2a2 2 0 0 1-4 0v-.2a1.9 1.9 0 0 0-3.2-1.4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.9 1.9 0 0 0-1.4-3.2H2a2 2 0 0 1 0-4h.2a1.9 1.9 0 0 0 1.4-3.2l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.9 1.9 0 0 0 3.2-1.4V2a2 2 0 0 1 4 0v.2a1.9 1.9 0 0 0 3.2 1.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.9 1.9 0 0 0 1.4 3.2h.2a2 2 0 0 1 0 4h-.2a1.9 1.9 0 0 0-1.4 1.4Z" />
        </svg>
      );
    case "chevron-down":
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "arrow-up-right":
      return (
        <svg {...common}>
          <path d="m7 17 10-10M9 7h8v8" />
        </svg>
      );
    case "arrow-down-right":
      return (
        <svg {...common}>
          <path d="m7 7 10 10M17 9v8H9" />
        </svg>
      );
    case "transfer":
      return (
        <svg {...common}>
          <path d="M7 7h11l-3-3M17 17H6l3 3" />
          <path d="M18 7v4M6 17v-4" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.8-4L3 9" />
          <path d="M3 4v5h5M4 13a8 8 0 0 0 14.8 4L21 15" />
          <path d="M21 20v-5h-5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3ZM19 16l.6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3.5 10h17" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M12 16V4M8 8l4-4 4 4M5 14v5h14v-5" />
        </svg>
      );
    case "more":
      return (
        <svg {...common}>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case "arrow-left":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6M9 12h10" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
          <circle cx="10" cy="8" r="3" />
          <path d="M16 11a3 3 0 0 0 0-6M18 20v-1.5a3.5 3.5 0 0 0-2.5-3.35" />
        </svg>
      );
  }
}
