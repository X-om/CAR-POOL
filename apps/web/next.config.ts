import type { NextConfig } from "next";

import os from "node:os";

function getLocalIpv4Addresses(): string[] {
  const networkInterfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const netIf of Object.values(networkInterfaces)) {
    if (!netIf) continue;
    for (const addr of netIf) {
      if (addr.family !== "IPv4") continue;
      if (addr.internal) continue;
      addresses.push(addr.address);
    }
  }

  return Array.from(new Set(addresses)).sort();
}

const nextConfig: NextConfig = {
  // Allow loading the dev server from LAN IPs (e.g. http://192.168.x.x:3002)
  // without hitting Next.js dev cross-origin resource blocking.
  // NOTE: This only affects development.
  allowedDevOrigins:
    process.env.NODE_ENV === "development" ? getLocalIpv4Addresses() : undefined,
};

export default nextConfig;
