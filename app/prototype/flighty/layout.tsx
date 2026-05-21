import { Chivo_Mono, Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-flighty-inter",
  display: "swap",
});

const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-flighty-chivo",
  display: "swap",
});

export default function FlightyPrototypeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${inter.variable} ${chivoMono.variable} min-h-[100dvh] bg-[#0a0a0a] text-white antialiased`}
      style={{
        fontFamily: "var(--font-flighty-inter), system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
