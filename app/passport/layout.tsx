import type { Metadata } from "next";
import { Chivo_Mono, Inter, JetBrains_Mono, Kode_Mono } from "next/font/google";

export const metadata: Metadata = {
  title: "My Lifetime Passport",
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-passport2-inter",
  display: "swap",
});

const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-passport2-chivo",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-passport2-jetbrains",
  display: "swap",
});

const kodeMono = Kode_Mono({
  subsets: ["latin"],
  variable: "--font-passport2-kode",
  display: "swap",
});

export default function PassportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${chivoMono.variable} ${jetbrains.variable} ${kodeMono.variable} min-h-[100dvh] text-neutral-100`}
      style={{ fontFamily: "var(--font-passport2-inter), system-ui, sans-serif" }}
    >
      {children}
    </div>
  );
}
