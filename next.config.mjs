/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // ✅ Evita que o navegador do usuário guarde a página em cache e continue
  // mostrando uma versão antiga do site depois de um novo deploy. Os
  // arquivos estáticos em /_next/static (JS, CSS) continuam com cache longo
  // normalmente, pois eles já têm nome único a cada build.
  async headers() {
    return [
      {
        // Proteções básicas do navegador (auditoria 16/nov/2026): impede o
        // site de ser aberto dentro de outro site (clickjacking), obriga o
        // tipo de arquivo declarado e limita o que vai no endereço de origem.
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
