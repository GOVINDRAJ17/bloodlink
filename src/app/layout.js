import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import SessionWrapper from "./components/SessionWrapper";
import { ThemeProvider } from "./components/ThemeProvider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});

export const metadata = {
  title: "BloodLink — Emergency Blood Coordination Platform",
  description: "Real-time, geospatial emergency blood coordination platform connecting hospitals, donors, and regional blood bank inventory.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${ibmPlexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans transition-colors duration-200">
        <SessionWrapper>
          <ThemeProvider>
            <Header />
            <main className="flex-1">{children}</main>
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}