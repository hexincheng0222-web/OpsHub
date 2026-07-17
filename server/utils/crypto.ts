import crypto from 'node:crypto'

/**
 * AES-256-GCM 凭据加密工具
 *
 * 密钥来源：`process.env.OPS_CRED_KEY`（64 位 hex 字符串，即 32 字节）
 *
 * 启动校验 (#35)：
 * - `credKeyReady()` 在 server/index.ts 启动序列中被显式调用
 * - 生产模式 (`NODE_ENV === 'production'`) 未配置即拒绝启动
 * - 开发模式允许跳过，但加密/解密操作会抛错
 */

function loadKey(): Buffer {
  return Buffer.from(process.env.OPS_CRED_KEY || '', 'hex')
}

let cachedKey: Buffer | null = null
function getKey(): Buffer {
  if (cachedKey === null) cachedKey = loadKey()
  return cachedKey
}

/** 重新读取密钥（用于运行时 `pm2 reload` 后生效） */
export function reloadCredKey(): void {
  cachedKey = loadKey()
}

export function credKeyReady(): boolean {
  return getKey().length === 32
}

/**
 * 启动期校验 — 在 server/index.ts 启动序列中显式调用
 * 生产模式未配置 OPS_CRED_KEY 则抛错拒启动
 */
export function assertCredKeyReady(): void {
  if (credKeyReady()) return
  const msg = '加密密钥未配置（OPS_CRED_KEY 需 64 位 hex 字符串，即 32 字节）'
  if (process.env.NODE_ENV === 'production') {
    console.error(`[crypto] ${msg}，生产模式拒启动`)
    throw new Error(msg)
  }
  console.warn(`[crypto] ${msg}，开发模式允许跳过，但凭据加密/解密不可用`)
}

export function encryptSecret(plain: string): string {
  const key = getKey()
  if (key.length !== 32) throw new Error('加密密钥未配置（OPS_CRED_KEY 需 32 字节 hex）')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(b64: string): string {
  const key = getKey()
  if (key.length !== 32) throw new Error('加密密钥未配置（OPS_CRED_KEY 需 32 字节 hex）')
  const buf = Buffer.from(b64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
