import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { AlertProvider } from "@/contexts/AlertContext";
import { Toaster } from "@/components/ui/toaster";
import { EnvironmentWarningBanner } from "@/components/EnvironmentWarningBanner";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <AlertProvider>
          <EnvironmentWarningBanner />
          <Component {...pageProps} />
          <Toaster />
        </AlertProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
