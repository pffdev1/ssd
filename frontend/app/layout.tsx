import type { Metadata } from "next";
import { Hind, Montserrat } from "next/font/google";
import { ToastProvider } from "@/src/shared/components/providers/ToastProvider";
import "./globals.css";

const sans = Hind({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans"
});

const heading = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
  variable: "--font-heading"
});

export const metadata: Metadata = {
  title: "Pedersen Connect | SSD",
  description: "Subaplicacion corporativa de Pedersen Connect para solicitudes, aprobaciones y notificaciones."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sans.variable} ${heading.variable}`}>
      <body>
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
