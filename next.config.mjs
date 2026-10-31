const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"
const isDev = process.env.NODE_ENV !== "production"

// Content Security Policy.
// - scripts/styles: Next.js injects inline bootstrap scripts and styles, so
//   'unsafe-inline' is needed without a nonce setup; dev mode also needs eval.
// - img/media: avatars and post media come from Cloudflare R2 (https), plus
//   data:/blob: for local previews and in-browser recordings.
// - connect: only our own origin, the Flask API, and R2.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  `connect-src 'self' ${API_URL} https://*.r2.dev https://*.r2.cloudflarestorage.com`,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera/mic are used by the in-app photo and video recorder.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ]
  },
}

export default nextConfig
