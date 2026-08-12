import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";
import { SEOElements } from "@/components/SEO";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <SEOElements />
      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
      >
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
