import type { Metadata } from "next";
import { Inter, Sora, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: 'swap' });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: 'swap' });
const plexMono = IBM_Plex_Mono({ weight: ['500'], subsets: ["latin"], variable: "--font-plex-mono", display: 'swap' });

export const metadata: Metadata = { title: "gisviz | Core Matrix" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${plexMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            {/* w-full ensures this wrapper spans the viewport so page-shell can center.
                (flex-1 alone was inert here because <body> isn't a flex container,
                 so the wrapper shrank to its content and hugged the left.) */}
            <div className="w-full flex flex-col min-h-screen">
              {children}
            </div>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}