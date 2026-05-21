import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Chivo_Mono, Inter } from "next/font/google";

export const metadata: Metadata = {
  title: "Concerts",
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-flighty-inter",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-flighty-chivo",
  display: "swap",
});

export default function ConcertsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${chivoMono.variable} min-h-[100dvh] bg-[rgba(19,19,19,0.99)] text-white antialiased`}
      style={{ fontFamily: "var(--font-flighty-inter), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
