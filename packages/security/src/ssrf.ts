import { isIP } from "node:net";

export type DestinationRule = {
  key: string;
  hostname: string;
  /** Only HTTPS/443 and direct public IPv4 targets in v1. */
  port: 443;
};
export type ResolvedEgress = { destinationKey: string; hostname: string; address: string; port: 443; protocol: "https:" };

function ipv4Number(address: string): number {
  return address.split(".").reduce((acc, byte) => (acc * 256 + Number(byte)) >>> 0, 0);
}
function inRange(ip: number, subnet: string, bits: number): boolean {
  const shift = (32 - bits) >>> 0;
  return (ip >>> shift) === (ipv4Number(subnet) >>> shift);
}
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4]
];
/** Rejects all IPv6 until a pinned connection transport with full v6 support is implemented. */
export function isPermittedPublicIpv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const ip = ipv4Number(address);
  return !BLOCKED_V4.some(([subnet, bits]) => inRange(ip, subnet, bits));
}
export function validateEgress(
  destinationKey: string,
  rawUrl: string,
  rules: readonly DestinationRule[],
  addresses: readonly string[]
): ResolvedEgress {
  const rule = rules.find(candidate => candidate.key === destinationKey);
  if (!rule) throw new Error("DESTINATION_NOT_ALLOWED");
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error("INVALID_DESTINATION"); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      (url.port && url.port !== "443") || url.hostname.endsWith(".") ||
      isIP(url.hostname) !== 0 || url.hostname.toLowerCase() !== rule.hostname.toLowerCase()) {
    throw new Error("DESTINATION_NOT_ALLOWED");
  }
  if (addresses.length < 1 || addresses.length > 16 ||
      addresses.some(address => !isPermittedPublicIpv4(address))) {
    throw new Error("BLOCKED_DNS_ADDRESS");
  }
  // All DNS answers must be public. Connection MUST use this pinned validated IP,
  // with TLS SNI and certificate validation against the original hostname.
  return { destinationKey, hostname: url.hostname.toLowerCase(),
    address: addresses[0]!, port: 443, protocol: "https:" };
}
export function rejectRedirect(status: number): void {
  // Server-side HTTP transport MUST disable automatic redirect following.
  if (status >= 300 && status < 400) throw new Error("REDIRECT_NOT_ALLOWED");
}
