import type { NextConfig } from "next";

// Security headers, applied to every response. CSP domains are based on
// what this app actually calls at runtime, verified by grep before writing
// this (not guessed): Supabase is the only third-party origin the browser
// talks to directly (client-side auth/DB calls) -- Unsplash, Travelpayouts,
// and Nominatim are all server-side only (Route Handlers hold their keys,
// see CLAUDE.md), trip photos are self-hosted locally in public/trips/ (not
// fetched from images.unsplash.com), the xlsx/SheetJS package is bundled at
// build time via a dynamic import (not fetched from cdn.sheetjs.com by the
// browser), and next/font/google self-hosts font files at build time (no
// runtime request to Google's font CDN). None of those four need a CSP
// allowance as a result -- confirmed, not assumed.
//
// No nonce-based CSP: Next's nonce approach requires every page to be
// dynamically rendered (disables static generation/ISR app-wide), which
// this app currently relies on for most routes. 'unsafe-inline' for
// script-src/style-src is the documented, static-generation-compatible
// tradeoff for an app without a compliance mandate for the stricter
// approach -- a real, disclosed choice, not an oversight. Revisit with a
// proxy.ts-based nonce (see Next's content-security-policy.md doc) if
// stricter script-src is ever needed.
const isDev = process.env.NODE_ENV === "development";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data:;
  font-src 'self';
  connect-src 'self' https://*.supabase.co wss://*.supabase.co;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, " ").trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera/mic/geolocation are never used anywhere in this app --
          // disabled outright rather than left to a permissive default.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // 2 years, includes subdomains. Not submitting to the browser
          // preload list (the "preload" directive) -- that's a real,
          // hard-to-reverse commitment across every subdomain this domain
          // will ever have, not something to opt into silently.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
