import type { Metadata } from "next";
import { Inter, Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { Providers } from "./providers";
import Navbar from "./components/Navbar";
import SubNavbar from "./components/SubNavbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: 'swap' });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: 'swap' });
const plexMono = IBM_Plex_Mono({ weight: ['500'], subsets: ["latin"], variable: "--font-plex-mono", display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: "gisviz",
    template: "%s | gisviz",
  },
  description: "Spatial publications and maps.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${plexMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            <div className="min-h-screen bg-gisviz-canvas/50 font-sans flex flex-col">
              {/* Navbar spans the viewport — sits OUTSIDE the width container */}
              <Navbar />
              <SubNavbar/>
              {/* All page content is centered and width-capped here, once */}
              <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex-1">
                {children}
              </main>
            </div>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}