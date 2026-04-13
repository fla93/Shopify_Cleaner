/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from any hostname (for product image URLs from various sources)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  // Ensure large Excel files can be uploaded (default is 4MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Forza HTTPS per 2 anni, inclusi sottodomini
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Previene clickjacking (causa avvisi su browser mobile)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Previene MIME-sniffing (causa blocchi su Chrome mobile)
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // No-cache per le pagine di autenticazione (evita problemi di sessione su mobile)
      {
        source: "/login",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
      {
        source: "/api/auth/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
