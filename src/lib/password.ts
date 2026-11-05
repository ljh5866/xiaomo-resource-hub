import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as bcryptNS from "bcryptjs";

/**
 * 密码哈希与校验。
 *
 * 本站新密码：scrypt（Node 内置，无依赖）
 *   scrypt$N$salt_hex$hash_hex
 *
 * 兼容历史数据：从 Supabase 迁移来的用户是 bcrypt
 *   $2a$10$... / $2b$10$... / $2y$10$...
 *
 * 校验成功后由调用方决定是否"就地升级"成 scrypt（needsRehash）。
 */

/**
 * bcryptjs 在 CJS/ESM 两种打包下导出形状不同：
 * 直接 import default 时，Next 打包后可能拿到 { default: {...} }。
 * 这里统一解一层，避免 compareSync 变成 undefined（会被 try/catch 吞掉，表现为"密码全错"）。
 */
const bcrypt = ((bcryptNS as unknown as { default?: unknown }).default ?? bcryptNS) as {
  compareSync: (password: string, hash: string) => boolean;
};

const N = 16384;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N });
  return `scrypt$${N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/** 是否为本站 scrypt 格式 */
export function isScryptHash(stored: string): boolean {
  return stored.startsWith("scrypt$");
}

/** 是否为 bcrypt（Supabase / GoTrue 的历史格式） */
export function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

/** 登录成功后是否需要换成更强的 scrypt */
export function needsRehash(stored: string): boolean {
  return !isScryptHash(stored);
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;

  try {
    if (isBcryptHash(stored)) {
      if (typeof bcrypt.compareSync !== "function") {
        console.error("[password] bcrypt 模块未正确加载，无法校验历史密码");
        return false;
      }
      return bcrypt.compareSync(password, stored);
    }

    if (!isScryptHash(stored)) return false;

    const [scheme, n, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, salt, expected.length, { N: Number(n) || N });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
