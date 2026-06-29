import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./dashboard/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TimeVault | Legacy Secured",
  description: "Secure your digital legacy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body 
        className={`${inter.className} bg-background text-foreground antialiased`}
        suppressHydrationWarning 
      >
        {children}
      </body>
    </html>
  );
}