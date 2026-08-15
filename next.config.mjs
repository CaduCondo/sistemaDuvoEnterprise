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
