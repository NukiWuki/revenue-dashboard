import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revenue Dashboard",
  description: "Дашборд доходов и потерь",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={geistSans.variable} style={{ colorScheme: 'light' }}>
      <body style={{ background: '#ffffff', color: '#111111', minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  );
}