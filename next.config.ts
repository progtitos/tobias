import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, too small for the receipt-photo upload (up to 5
      // photos per Server Action call). Vercel's serverless functions have
      // their own hard, non-configurable 4.5MB request body cap, so this is
      // set below that with headroom — the client also compresses photos
      // before upload (see ReceiptUploadClient) so real-world payloads stay
      // well under either limit.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
