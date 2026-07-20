import { Router, Request, Response } from 'express'
import db from '../db'
import http from 'http'
import crypto from 'crypto'
import { logOperation, logCtx } from '../logOperation'

const router = Router()

// ========== ATCOM Digest Auth 客户端 ==========

interface DigestAuthState {
  realm: string
  nonce: string
  qop: string
  opaque: string
  ha1: string
  nonceCount: number
}

const digestCache = new Map<string, DigestAuthState>()

function parseDigestChallenge(wwwAuth: string): { realm: string; nonce: string; qop: string; opaque: string } {
  const params: Record<string, string> = {}
  for (const m of wwwAuth.matchAll(/(\w+)="?([^",]+)"?/g)) {
    params[m[1]] = m[2]
  }
  return { realm: params.realm || '', nonce: params.nonce || '', qop: params.qop || 'auth', opaque: params.opaque || '' }
}

function buildDigestAuth(ip: string, method: string, uri: string, username: string, password: string): string {
  let state = digestCache.get(ip)
  if (!state) {
    // 首次需要先获取 challenge
    return ''
  }
  state.nonceCount++
  const nc = format(state.nonceCount, '08x')
  const cnonce = crypto.randomBytes(8).toString('hex')

  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex')
  const response = crypto.createHash('md5').update(`${state.ha1}:${state.nonce}:${nc}:${cnonce}:${state.qop}:${ha2}`).digest('hex')

  return `Digest username="${username}", realm="${state.realm}", nonce="${state.nonce}", uri="${uri}", response="${response}", qop=${state.qop}, nc=${nc}, cnonce="${cnonce}", opaque="${state.opaque}"`
}

function format(n: number, fmt: string): string {
  return n.toString(16).padStart(8, '0')
}

// 带 Digest Auth 的 HTTP 请求
function atcomRequest(ip: string, command: string, method: 'GET' | 'POST', data: string = '', username = 'admin', password = process.env.ATCOM_PBX_PASS || ''): Promise<any> {
  const url = `/cgi-bin/web_cgi_main.cgi?${command}`
  return new Promise((resolve, reject) => {
    const doRequest = (authHeader?: string) => {
      const headers: Record<string, string> = { 'User-Agent': 'OpsHub/1.0' }
      if (authHeader) headers['Authorization'] = authHeader
      if (method === 'POST') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
        headers['Content-Length'] = Buffer.byteLength(data).toString()
      }
      const req = http.request({ host: ip, port: 80, path: url, method, headers, timeout: 10000 }, (res) => {
        let body = ''
        res.on('data', c => { body += c })
        res.on('end', () => {
          if (res.statusCode === 401) {
            const wwwAuth = res.headers['www-authenticate'] || ''
            if (!wwwAuth) { reject(new Error('未收到认证挑战')); return }

            // 解析 challenge 并缓存
            const challenge = parseDigestChallenge(wwwAuth)
            const ha1 = crypto.createHash('md5').update(`${username}:${challenge.realm}:${password}`).digest('hex')
            digestCache.set(ip, { ...challenge, ha1, nonceCount: 0 })

            // 带认证重试
            const auth = buildDigestAuth(ip, method, url, username, password)
            if (!auth) { reject(new Error('认证失败')); return }

            const retryHeaders: Record<string, string> = { 'User-Agent': 'OpsHub/1.0', 'Authorization': auth }
            if (method === 'POST') {
              retryHeaders['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8'
              retryHeaders['Content-Length'] = Buffer.byteLength(data).toString()
            }
            const retryReq = http.request({ host: ip, port: 80, path: url, method, headers: retryHeaders, timeout: 10000 }, (retryRes) => {
              let retryBody = ''
              retryRes.on('data', c => { retryBody += c })
              retryRes.on('end', () => {
                if (retryRes.statusCode === 401) { reject(new Error('认证失败，请检查用户名密码')); return }
                try { resolve(JSON.parse(retryBody)) } catch { resolve(retryBody) }
              })
            })
            retryReq.on('error', reject)
            retryReq.on('timeout', () => { retryReq.destroy(); reject(new Error('timeout')) })
            if (method === 'POST' && data) retryReq.write(data)
            retryReq.end()
            return
          }
          try { resolve(JSON.parse(body)) } catch { resolve(body) }
        })
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
      if (method === 'POST' && data) req.write(data)
      req.end()
    }
    doRequest()
  })
}

// ── 缓存 ─────────────────────────────────────────────────────
let cache: { data: any[]; ts: number } | null = null
const CACHE_TTL = 180_000 // 3 分钟

export function getCachedPhones() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data
  return null
}

/** 确保缓存存在（首页/其它模块调用时不会因空缓存而查不到数据） */
export async function ensurePhoneCache(): Promise<void> {
  if (!cache || Date.now() - cache.ts >= CACHE_TTL) {
    const devices = await discoverPhones()
    cache = { data: devices, ts: Date.now() }
  }
}

// ── 读取配置 ─────────────────────────────────────────────────
function getConfig() {
  const rows = db.prepare("SELECT key, value FROM system_config WHERE key LIKE 'atcom_%'").all() as { key: string; value: string }[]
  const map: Record<string, string> = {}
  rows.forEach(r => { map[r.key] = r.value })
  return {
    // 默认置空，未配置时拒绝调用 (#6)
    ip: map['atcom_pbx_ip'] || process.env.ATCOM_PBX_IP || '192.168.35.250',
    user: map['atcom_pbx_user'] || process.env.ATCOM_PBX_USER || 'admin',
    pass: map['atcom_pbx_pass'] || process.env.ATCOM_PBX_PASS || '',
  }
}

// ── HTTP 请求工具 ─────────────────────────────────────────────
function httpGet(host: string, path: string, headers: Record<string, string> = {}, timeout = 10000): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port: 80, path, method: 'GET', headers: { 'User-Agent': 'OpsHub-Phones/1.0', ...headers }, timeout }, (res) => {
      let body = ''
      res.on('data', c => { body += c })
      res.on('end', () => {
        const h: Record<string, string> = {}
        Object.entries(res.headers).forEach(([k, v]) => { if (v) h[k] = Array.isArray(v) ? v[0] : v })
        resolve({ status: res.statusCode || 0, headers: h, body })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.end()
  })
}

function httpPost(host: string, path: string, body: string, headers: Record<string, string> = {}, timeout = 10000): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port: 80, path, method: 'POST', headers: { 'User-Agent': 'OpsHub-Phones/1.0', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body).toString(), ...headers }, timeout }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        const h: Record<string, string> = {}
        Object.entries(res.headers).forEach(([k, v]) => { if (v) h[k] = Array.isArray(v) ? v[0] : v })
        resolve({ status: res.statusCode || 0, headers: h, body: data })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
    req.write(body)
    req.end()
  })
}

// ── 设备发现逻辑 ─────────────────────────────────────────────

interface PhoneDevice {
  id: string
  cfgId: string
  extension: string
  ip: string
  address: string
  status: string
  delay: string
  registered: string
  online: boolean
  secret: string
  display_name: string
}

async function discoverPhones(): Promise<PhoneDevice[]> {
  const cfg = getConfig()

  // Step 1: 登录
  const loginResp = await httpPost(cfg.ip, '/cgi-bin/luci',
    `luci_username=${cfg.user}&luci_password=${cfg.pass}`, {}, 5000)

  const setCookie = loginResp.headers['set-cookie'] || loginResp.headers['Set-Cookie'] || ''
  let sysauth = ''
  for (const part of setCookie.split(';')) {
    const t = part.trim()
    if (t.startsWith('sysauth=')) { sysauth = t.split('=')[1]; break }
  }
  let stok = ''
  const loc = loginResp.headers['location'] || loginResp.headers['Location'] || ''
  let m = loc.match(/stok=([a-f0-9]+)/)
  if (m) stok = m[1]
  if (!stok) { m = loginResp.body.match(/stok=([a-f0-9]+)/); if (m) stok = m[1] }
  if (!sysauth || !stok) throw new Error('IPPBX200 登录失败')

  // Step 2: 获取分机配置
  const extResp = await httpGet(cfg.ip,
    `/cgi-bin/luci/;stok=${stok}/admin/extension/sip/get`,
    { Cookie: `sysauth=${sysauth}` })
  const extData = JSON.parse(extResp.body)
  const extensions: any[] = extData.data || extData || []

  // Step 3: 获取分机状态
  const statusResp = await httpGet(cfg.ip,
    `/cgi-bin/luci/;stok=${stok}/admin/status/sipext/get`,
    { Cookie: `sysauth=${sysauth}` })
  const statusData = JSON.parse(statusResp.body)
  const statusEntries: any[] = statusData.data || statusData || []
  const allIds = statusEntries.map(e => e.id).filter(Boolean)
  if (!allIds.length) throw new Error('未获取到分机 ID')

  // Step 4: 刷新实时状态
  const idsStr = allIds.join(',')
  const refreshResp = await httpGet(cfg.ip,
    `/cgi-bin/luci/;stok=${stok}/admin/status/sipext/update?ids=${idsStr}`,
    { Cookie: `sysauth=${sysauth}` }, 30000)
  let realtime: any[]
  try {
    const parsed = JSON.parse(refreshResp.body)
    realtime = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    throw new Error('刷新状态返回数据解析失败')
  }

  // 合并
  const extMap: Record<string, any> = {}
  extensions.forEach(e => { if (e.id) extMap[e.id] = e })

  const devices: PhoneDevice[] = realtime.map(entry => {
    const ext = extMap[entry.id] || {}
    const address = entry.address || 'n/a'
    const m2 = address.match(/@([\d.]+):/)
    const ip = m2 ? m2[1] : ''
    const isOnline = entry.registered === 'Avail' || (ip && address !== 'n/a')
    return {
      id: entry.id,
      cfgId: entry.id,
      extension: entry.devicenumber || ext.devicenumber || '?',
      ip,
      address,
      status: entry.status || 'n/a',
      delay: entry.delay || 'n/a',
      registered: entry.registered || 'n/a',
      online: isOnline,
      secret: ext.secret || '',
      display_name: ext.display_name || '',
    }
  })

  // 保存在线话机的 IP 到历史记录
  const upsertIp = db.prepare(`INSERT INTO phone_ip_history (phone_id, extension, ip, mac, last_seen)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(phone_id) DO UPDATE SET ip=excluded.ip, mac=excluded.mac, last_seen=datetime('now'), extension=excluded.extension`)
  const batch = db.transaction(() => {
    for (const d of devices) {
      if (d.online && d.ip) upsertIp.run(d.id, d.extension, d.ip, '')
    }
  })
  batch()

  return devices
}

// ── API 路由 ─────────────────────────────────────────────────

// GET /api/v1/phones — 获取所有话机列表
router.get('/', async (_req: Request, res: Response) => {
  try {
    const cached = getCachedPhones()
    const devices = cached || await discoverPhones()
    if (!cached) cache = { data: devices, ts: Date.now() }

    // 自动同步分机号到字典表（新分机自动插入，已有不覆盖）
    if (devices.length > 0) {
      const insertLoc = db.prepare(
        'INSERT OR IGNORE INTO phone_locations (extension) VALUES (?)'
      )
      const syncBatch = db.transaction(() => {
        for (const d of devices) {
          if (d.extension) insertLoc.run(d.extension)
        }
      })
      syncBatch()
    }

    // 合并上次 IP 和位置信息
    const ipMap: Record<string, string> = {}
    const ipRows = db.prepare('SELECT phone_id, ip, last_seen FROM phone_ip_history').all() as any[]
    ipRows.forEach(r => { ipMap[r.phone_id] = r.ip })

    const locMap: Record<string, string> = {}
    const locRows = db.prepare('SELECT extension, location FROM phone_locations').all() as any[]
    locRows.forEach(r => { locMap[r.extension] = r.location })

    const remarkMap: Record<string, string> = {}
    const remarkRows = db.prepare('SELECT extension, remark FROM phone_remarks').all() as any[]
    remarkRows.forEach(r => { remarkMap[r.extension] = r.remark })

    const enriched = devices.map((d: any) => ({
      ...d,
      lastIp: ipMap[d.id] || '',
      location: locMap[d.extension] || '',
      remark: remarkMap[d.extension] || '',
    }))

    res.json({
      code: 200,
      data: enriched,
      total: enriched.length,
      online: enriched.filter((d: any) => d.online).length,
      offline: enriched.filter((d: any) => !d.online).length,
      cached: !!cached,
    })
  } catch (err: any) {
    const msg = err.message || '设备发现失败'
    const userMsg = msg === 'timeout' ? '连接 PBX 设备超时' :
                    msg.includes('登录失败') ? 'PBX 登录失败，请检查用户名和密码' :
                    msg.includes('ECONNREFUSED') ? '无法连接 PBX 设备，请检查 IP 地址' :
                    msg
    res.status(502).json({ code: 502, message: userMsg })
  }
})

// GET /api/v1/phones/refresh — 强制刷新
router.get('/refresh', async (_req: Request, res: Response) => {
  try {
    const devices = await discoverPhones()
    cache = { data: devices, ts: Date.now() }
    res.json({
      code: 200,
      data: devices,
      total: devices.length,
      online: devices.filter(d => d.online).length,
      offline: devices.filter(d => !d.online).length,
      cached: false,
    })
  } catch (err: any) {
    const msg = err.message || '设备发现失败'
    const userMsg = msg === 'timeout' ? '连接 PBX 设备超时' :
                    msg.includes('登录失败') ? 'PBX 登录失败，请检查用户名和密码' :
                    msg.includes('ECONNREFUSED') ? '无法连接 PBX 设备，请检查 IP 地址' :
                    msg
    res.status(502).json({ code: 502, message: userMsg })
  }
})

// GET /api/v1/phones/:id/details — 获取单台话机详情
router.get('/:id/details', async (req: Request, res: Response) => {
  const devices = cache?.data || []
  const phone = devices.find((d: any) => d.id === req.params.id)
  if (!phone) return res.status(404).json({ code: 404, message: '话机不存在' })
  if (!phone.online) return res.status(400).json({ code: 400, message: '话机离线，无法获取详情' })

  try {
    // 通过 ATCOM API 获取话机详情
    const [status, account, remotePhonebook] = await Promise.all([
      atcomGet(phone.ip, 'status_get').catch(() => null),
      atcomGet(phone.ip, 'user_get_account_basic').catch(() => null),
      atcomGet(phone.ip, 'user_get_xml_remote_phonebook').catch(() => null),
    ])
    res.json({ code: 200, data: { phone, status, account, remotePhonebook } })
  } catch (err: any) {
    res.status(502).json({ code: 502, message: err.message || '获取详情失败' })
  }
})

// PUT /api/v1/phones/:id/account — 修改账号配置并同步到话机
router.put('/:id/account', async (req: Request, res: Response) => {
  const devices = cache?.data || []
  const phone = devices.find((d: any) => d.id === req.params.id)
  if (!phone) return res.status(404).json({ code: 404, message: '话机不存在' })
  if (!phone.online) return res.status(400).json({ code: 400, message: '话机离线，无法修改配置' })

  const d = req.body
  // 构建 ATCOM API 参数
  const params: string[] = []
  const fieldMap: Record<string, string> = {
    sipServer: 'SIPServerHost', sipServerPort: 'SIPServerPort',
    userName: 'SIPAccount', password: 'SIPPassword',
    displayName: 'DisplayName', registerName: 'RegisterName',
    transport: 'Transport', natTraversal: 'NATTraversal',
    voiceMail: 'VoiceMailNumber',
    backupSipServer: 'BackupSIPServerHost', backupSipPort: 'BackupSIPServerPort',
    outboundProxy: 'OutboundProxyServerHost', outboundProxyPort: 'OutboundProxyServerPort',
  }
  for (const [key, atcomKey] of Object.entries(fieldMap)) {
    if (d[key] !== undefined) params.push(`${atcomKey}=${encodeURIComponent(d[key])}`)
  }
  if (params.length === 0) return res.status(400).json({ code: 400, message: '无配置项' })

  try {
    const result = await atcomPost(phone.ip, 'user_set_account_basic', params.join('&'))
    logOperation({ module: '话机配置', action: '修改', target: `${phone.extension} 账号配置`, detail: params.join('&'), operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: result, message: '配置已同步到话机' })
  } catch (err: any) {
    res.status(502).json({ code: 502, message: err.message || '同步失败' })
  }
})

// PUT /api/v1/phones/:id/remote-phonebook — 更新话机远程电话本配置
router.put('/:id/remote-phonebook', async (req: Request, res: Response) => {
  const devices = cache?.data || []
  const phone = devices.find((d: any) => d.id === req.params.id)
  if (!phone) return res.status(404).json({ code: 404, message: '话机不存在' })
  if (!phone.online) return res.status(400).json({ code: 400, message: '话机离线，无法修改配置' })

  const { xmlUrl, name } = req.body
  if (!xmlUrl) return res.status(400).json({ code: 400, message: 'XML 电话本 URL 必填' })

  try {
    const params = `phonebook1_remote_url=${encodeURIComponent(xmlUrl)}&phonebook1_display_name=${encodeURIComponent(name || '公司电话簿')}`
    const result = await atcomPost(phone.ip, 'user_set_xml_remote_phonebook', params)
    logOperation({ module: '话机配置', action: '修改', target: `${phone.extension} 远程电话本`, detail: `URL: ${xmlUrl}`, operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: result, message: '远程电话本配置已同步到话机' })
  } catch (err: any) {
    res.status(502).json({ code: 502, message: err.message || '同步失败' })
  }
})

// POST /api/v1/phones/:id/reboot — 重启话机
router.post('/:id/reboot', async (req: Request, res: Response) => {
  const devices = cache?.data || []
  const phone = devices.find((d: any) => d.id === req.params.id)
  if (!phone) return res.status(404).json({ code: 404, message: '话机不存在' })
  if (!phone.online) return res.status(400).json({ code: 400, message: '话机离线' })

  try {
    await atcomPost(phone.ip, 'reboot', '')
    logOperation({ module: '话机管理', action: '重启', target: phone.extension, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, message: '重启指令已发送' })
  } catch (err: any) {
    res.status(502).json({ code: 502, message: err.message || '重启失败' })
  }
})

// PUT /api/v1/phones/:id/remark — 修改话机备注（按分机号 UPSERT 到 phone_remarks）
router.put('/:id/remark', async (req: Request, res: Response) => {
  const devices = cache?.data || []
  const phone = devices.find((d: any) => d.id === req.params.id)
  if (!phone) return res.status(404).json({ code: 404, message: '话机不存在' })

  const remark = (req.body?.remark ?? '').toString().slice(0, 500)
  try {
    db.prepare(
      `INSERT INTO phone_remarks (extension, remark, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(extension) DO UPDATE SET remark = excluded.remark, updated_at = datetime('now')`
    ).run(phone.extension, remark)
    logOperation({ module: '话机管理', action: '修改备注', target: phone.extension, detail: remark ? `备注已更新：${remark.slice(0, 50)}` : '备注已清空', operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, data: { extension: phone.extension, remark } })
  } catch (err: any) {
    console.error('[server] 修改话机备注失败:', err.message)
    res.status(500).json({ code: 500, message: '保存失败', traceId: crypto.randomBytes(4).toString('hex') })
  }
})

// ATCOM 话机 API 封装（带 Digest Auth）
// #29: 凭据从 getConfig() 统一读取，不再硬编码 'admin' 默认回退
function atcomGet(ip: string, command: string, username?: string, password?: string): Promise<any> {
  return atcomRequest(ip, command, 'GET', '', username, password)
}

function atcomPost(ip: string, command: string, data: string, username?: string, password?: string): Promise<any> {
  return atcomRequest(ip, command, 'POST', data, username, password)
}

// ========== 电话簿 ==========

// GET /phonebook — 联系人列表
router.get('/phonebook', (req: Request, res: Response) => {
  const search = req.query.search as string
  const type = req.query.type as string
  let where = 'WHERE 1=1'
  const params: any[] = []
  if (search) { where += ' AND (name LIKE ? OR number LIKE ? OR department LIKE ?)'; const kw = `%${search}%`; params.push(kw, kw, kw) }
  if (type) { where += ' AND type = ?'; params.push(type) }
  const rows = db.prepare(`SELECT * FROM phonebook_contacts ${where} ORDER BY sort_order ASC, id ASC`).all(...params)
  res.json({ code: 200, data: rows })
})

// POST /phonebook — 新增联系人
router.post('/phonebook', (req: Request, res: Response) => {
  const d = req.body
  if (!d.name || !d.number) return res.status(400).json({ code: 400, message: '姓名和号码必填' })
  try {
    const r = db.prepare('INSERT INTO phonebook_contacts (name,number,department,position,type,notes) VALUES (?,?,?,?,?,?)')
      .run(d.name, d.number, d.department||'', d.position||'', d.type||'external', d.notes||'')
    logOperation({ module: '电话簿', action: '新增', target: d.name, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    const row = db.prepare('SELECT * FROM phonebook_contacts WHERE id = ?').get(r.lastInsertRowid)
    res.status(201).json({ code: 201, data: row })
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ code: 409, message: '联系人已存在' })
    res.status(500).json({ code: 500, message: '创建失败', traceId: crypto.randomBytes(4).toString('hex') })
  }
})

// PUT /phonebook/:id — 修改联系人
router.put('/phonebook/:id', (req: Request, res: Response) => {
  try {
    const d = req.body
    const fields: string[] = [], values: any[] = []
    for (const key of ['name','number','department','position','type','notes']) {
      if (d[key] !== undefined) { fields.push(`${key} = ?`); values.push(d[key]) }
    }
    if (!fields.length) return res.status(400).json({ code: 400, message: '无更新字段' })
    fields.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare(`UPDATE phonebook_contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    logOperation({ module: '电话簿', action: '修改', target: d.name || `ID:${req.params.id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    const row = db.prepare('SELECT * FROM phonebook_contacts WHERE id = ?').get(req.params.id)
    res.json({ code: 200, data: row })
  } catch (err: any) {
    console.error('[server] 修改联系人失败:', err.message)
    res.status(500).json({ code: 500, message: '修改联系人失败' })
  }
})

// DELETE /phonebook/:id — 删除联系人
router.delete('/phonebook/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT name FROM phonebook_contacts WHERE id = ?').get(req.params.id) as any
    if (!existing) return res.status(404).json({ code: 404, message: '联系人不存在' })
    db.prepare('DELETE FROM phonebook_contacts WHERE id = ?').run(req.params.id)
    logOperation({ module: '电话簿', action: '删除', target: existing.name || `ID:${req.params.id}`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    res.status(204).send()
  } catch (err: any) {
    console.error('[server] 删除联系人失败:', err.message)
    res.status(500).json({ code: 500, message: '删除联系人失败' })
  }
})

// POST /phonebook/batch-delete
router.post('/phonebook/batch-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ code: 400, message: 'ids 必填' })
    if (ids.length > 1000) return res.status(400).json({ code: 400, message: '单次最多操作 1000 条' })
    const cleanIds = ids.filter((id) => Number.isInteger(id) && id > 0)
    if (!cleanIds.length) return res.status(400).json({ code: 400, message: 'ids 参数无效' })
    const ph = cleanIds.map(() => '?').join(',')
    db.prepare(`DELETE FROM phonebook_contacts WHERE id IN (${ph})`).run(...cleanIds)
    logOperation({ module: '电话簿', action: '批量删除', target: `${cleanIds.length} 条`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
    res.json({ code: 200, message: `已删除 ${cleanIds.length} 条` })
  } catch (err: any) {
    console.error('[server] 批量删除联系人失败:', err.message)
    res.status(500).json({ code: 500, message: '批量删除失败' })
  }
})

// POST /phonebook/import — 批量导入
router.post('/phonebook/import', (req: Request, res: Response) => {
  const { rows } = req.body
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ code: 400, message: '无数据' })
  const insert = db.prepare('INSERT OR IGNORE INTO phonebook_contacts (name, number, department, position, type, notes) VALUES (?, ?, ?, ?, ?, ?)')
  let imported = 0
  const errors: string[] = []
  const batch = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.name || !r.number) { errors.push(`第${i+1}行: 姓名或号码为空`); continue }
      try { insert.run(r.name, r.number, r.department||'', r.position||'', r.type||'external', r.notes||''); imported++ }
      catch (e: any) { errors.push(`第${i+1}行: ${e.message}`) }
    }
  })
  batch()
  logOperation({ module: '电话簿', action: '导入', target: `${imported} 条`, detail: '', operator: req.user?.username || '', ...logCtx(req) })
  res.json({ code: 200, data: { imported, errors } })
})

// POST /phonebook/sync-from-pbx — 从 PBX 同步内部联系人
router.post('/phonebook/sync-from-pbx', async (_req: Request, res: Response) => {
  try {
    const devices = cache?.data || await discoverPhones()
    if (!cache) cache = { data: devices, ts: Date.now() }
    // 获取分机配置（包含 display_name）
    const cfg = getConfig()
    const loginResp = await httpPost(cfg.ip, '/cgi-bin/luci', `luci_username=${cfg.user}&luci_password=${cfg.pass}`, {}, 5000)
    const setCookie = loginResp.headers['set-cookie'] || ''
    let sysauth = '', stok = ''
    for (const part of setCookie.split(';')) { const t = part.trim(); if (t.startsWith('sysauth=')) sysauth = t.split('=')[1] }
    const loc = loginResp.headers['location'] || ''
    let m = loc.match(/stok=([a-f0-9]+)/)
    if (m) stok = m[1]
    if (!stok) { m = loginResp.body.match(/stok=([a-f0-9]+)/); if (m) stok = m[1] }
    if (!sysauth || !stok) throw new Error('PBX 登录失败')

    const extResp = await httpGet(cfg.ip, `/cgi-bin/luci/;stok=${stok}/admin/extension/sip/get`, { Cookie: `sysauth=${sysauth}` })
    const extData = JSON.parse(extResp.body)
    const extensions: any[] = extData.data || []

    const upsert = db.prepare(`INSERT INTO phonebook_contacts (name, number, department, type) VALUES (?, ?, ?, 'internal')
      ON CONFLICT(name, number) DO UPDATE SET department=excluded.department, type='internal', updated_at=datetime('now')`)
    let synced = 0
    const batch = db.transaction(() => {
      for (const ext of extensions) {
        if (!ext.devicenumber) continue
        upsert.run(ext.display_name || ext.devicenumber, ext.devicenumber, ext.department || '')
        synced++
      }
    })
    batch()
    logOperation({ module: '电话簿', action: 'PBX同步', target: `${synced} 个分机`, detail: '', operator: _req.user?.username || '', ...logCtx(_req) })
    res.json({ code: 200, data: { synced } })
  } catch (err: any) {
    res.status(502).json({ code: 502, message: err.message || '同步失败' })
  }
})

// GET /phonebook.xml — XML 电话簿（话机拉取用）
router.get('/phonebook.xml', (_req: Request, res: Response) => {
  const contacts = db.prepare('SELECT name, number, department FROM phonebook_contacts ORDER BY sort_order ASC, id ASC').all() as any[]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<IPPhoneDirectory>
${contacts.map(c => `  <DirectoryEntry>
    <Name>${(c.name||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Name>
    <Telephone>${c.number||''}</Telephone>
  </DirectoryEntry>`).join('\n')}
</IPPhoneDirectory>`
  res.set('Content-Type', 'application/xml; charset=utf-8')
  res.send(xml)
})

// POST /phonebook/deploy — 推送电话簿到选中话机
//   body: { phoneIds, mode, xmlUrl?, name? }
//   xmlUrl/name 可选，不传时 fallback 到服务器默认 URL + "公司电话簿"
router.post('/phonebook/deploy', async (req: Request, res: Response) => {
  const { phoneIds, mode, xmlUrl: customXmlUrl, name: customName } = req.body // mode: 'remote' | 'local' | 'both'
  if (!Array.isArray(phoneIds) || !phoneIds.length) return res.status(400).json({ code: 400, message: '请选择话机' })

  const devices = cache?.data || []
  const targetPhones = devices.filter((d: any) => phoneIds.includes(d.id) && d.online)
  if (!targetPhones.length) return res.status(400).json({ code: 400, message: '选中的话机均不在线' })

  // XML URL：优先用前端传入，否则用本机地址构建
  const host = req.headers.host?.split(':')[0] || 'localhost'
  const port = req.headers.host?.split(':')[1] || '3001'
  const xmlUrl = customXmlUrl || `http://${host}:${port}/api/v1/phones/phonebook.xml`
  const phonebookName = customName || '公司电话簿'

  const results: any[] = []
  for (const phone of targetPhones) {
    try {
      if (mode === 'remote' || mode === 'both') {
        // 设置远程电话簿 URL
        await atcomPost(phone.ip, `user_set_xml_remote_phonebook`, `phonebook1_remote_url=${encodeURIComponent(xmlUrl)}&phonebook1_display_name=${encodeURIComponent(phonebookName)}`)
      }
      if (mode === 'local' || mode === 'both') {
        // 推送本地联系人
        const contacts = db.prepare('SELECT name, number FROM phonebook_contacts ORDER BY sort_order ASC, id ASC').all() as any[]
        const contactStr = contacts.map((c, i) => `ContactName_${i}=${encodeURIComponent(c.name)}&ContactNumber_${i}=${encodeURIComponent(c.number)}`).join('&')
        await atcomPost(phone.ip, `user_set_contacts`, contactStr)
      }
      results.push({ id: phone.id, extension: phone.extension, status: 'success' })
    } catch (e: any) {
      results.push({ id: phone.id, extension: phone.extension, status: 'failed', error: e.message })
    }
  }
  logOperation({ module: '电话簿', action: '推送', target: `${targetPhones.length} 台话机`, detail: JSON.stringify(results), operator: req.user?.username || '', ...logCtx(req) })
  res.json({ code: 200, data: { total: targetPhones.length, success: results.filter(r => r.status === 'success').length, failed: results.filter(r => r.status === 'failed').length, results } })
})

export default router
