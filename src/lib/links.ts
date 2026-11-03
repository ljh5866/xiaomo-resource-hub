import { createHash } from "node:crypto";

/** 只存哈希，不存明文 IP（docs/02 §4.3） */
export function hashIp(ip: string) {
  return createHash("sha256")
    .update(`${ip}:xiaomo`)
    .digest("hex")
    .slice(0, 32);
}

export { sniffExtractCode } from "./extract-code";

export function hashUrl(url: string) {
  return createHash("sha256").update(url.trim()).digest("hex");
}
