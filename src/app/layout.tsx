import type { Metadata, Viewport } from "next";
import { Inter, Sora, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

// Force dynamic rendering for all routes to prevent prerendering issues
export const dynamic = "force-dynamic";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

const sora = Sora({ 
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

export const metadata: Metadata = {
  title: "SuperBotijo - OpenClaw SuperBotijo",
  description: "Your OpenClaw agent dashboard powered by SuperBotijo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{__html:`if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js")`}} />
      </head>
      <body 
        className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} font-sans`}
        style={{ 
          backgroundColor: 'var(--background)', 
          color: 'var(--foreground)',
          fontFamily: 'var(--font-body)'
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
