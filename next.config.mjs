/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  allowedDevOrigins: ["192.168.1.4"],

  outputFileTracingIncludes: {
    "/api/solicitudes-cotizacion": [
      "./lib/plantilla-cotizacion-ch-f-002.part0.b64",
      "./lib/plantilla-cotizacion-ch-f-002.part1.b64",
      "./lib/plantilla-cotizacion-ch-f-002.part2.b64",
      "./lib/plantilla-cotizacion-ch-f-002.part3.b64",
      "./lib/plantilla-cotizacion-ch-f-002.part4.b64",
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
