# OpsHub 账号系统实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 OpsHub 添加基于 JWT 的用户认证和角色权限系统

**架构：** 后端使用 JWT + bcryptjs 实现认证，中间件保护路由；前端使用 Pinia store 管理认证状态，路由守卫控制访问权限

**技术栈：** jsonwebtoken, bcryptjs, Vue 3, Pinia, Element Plus

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `server/middleware/auth.ts` | JWT 校验中间件 + 角色校验中间件 |
| `server/routes/auth.ts` | 认证相关 API（登录、获取当前用户、修改密码） |
| `server/routes/users.ts` | 用户管理 CRUD API |
| `src/api/auth.ts` | 前端认证 API 封装 |
| `src/api/users.ts` | 前端用户管理 API 封装 |
| `src/stores/auth.ts` | 用户认证状态管理 |
| `src/views/LoginView.vue` | 登录页面 |
| `src/views/admin/AdminUsers.vue` | 用户管理页面 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `package.json` | 添加 bcryptjs, jsonwebtoken 依赖 |
| `server/db.ts` | 添加 users 表 + operation_logs.operator 字段 + 默认管理员初始化 |
| `server/index.ts` | 注册 auth/users 路由 + 添加认证中间件 |
| `server/routes/admin.ts` | 修改 logOperation 记录操作人 |
| `src/api/request.ts` | 添加 Authorization header + 401 处理 |
| `src/router/index.ts` | 添加 /login 路由 + beforeEach 守卫 |
| `src/views/admin/AdminView.vue` | 侧栏添加用户管理菜单项 |

---

## 任务 1：安装依赖

**文件：**
- 修改：`package.json`

- [ ] **步骤 1：安装 bcryptjs 和 jsonwebtoken 及其类型**

```bash
cd C:/Users/何鑫城/Desktop/OpsHub
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
```

- [ ] **步骤 2：验证安装**

检查 package.json 的 dependencies 中包含：
- `"bcryptjs": "^2.4.3"`
- `"jsonwebtoken": "^9.0.2"`

devDependencies 中包含：
- `"@types/bcryptjs": "^2.4.6"`
- `"@types/jsonwebtoken": "^9.0.7"`

- [ ] **步骤 3：Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: 添加 bcryptjs 和 jsonwebtoken 依赖"
```

---

## 任务 2：数据库 — users 表 + operation_logs 改造

**文件：**
- 修改：`server/db.ts`

- [ ] **步骤 1：在 db.ts 的建表语句末尾添加 users 表**

在 `db.exec(` 建表语句的最后（`system_config` 表之后）添加：

```sql
CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role         TEXT NOT NULL DEFAULT 'user',
  is_active    INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **步骤 2：在迁移区域添加 operation_logs.operator 字段**

在 `db.ts` 底部迁移代码区域添加：

```typescript
// 迁移：operation_logs 添加 operator 字段
const olColumns = db.prepare("PRAGMA table_info(operation_logs)").all() as { name: string }[]
if (olColumns.length > 0 && !olColumns.some(c => c.name === 'operator')) {
  db.exec("ALTER TABLE operation_logs ADD COLUMN operator TEXT NOT NULL DEFAULT ''")
  console.log('[db] 已添加 operation_logs.operator 列')
}
```

- [ ] **步骤 3：添加默认超级管理员初始化**

在迁移代码之后、`export default db` 之前添加：

```typescript
// 初始化：如果 users 表为空，创建默认超级管理员
const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
if (userCount === 0) {
  const bcrypt = require('bcryptjs')
  const hash = bcrypt.hashSync('admin123', 10)
  db.prepare(
    "INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)"
  ).run('admin', hash, '超级管理员', 'superadmin')
  console.log('[db] 已创建默认超级管理员账号：admin / admin123')
}
```

- [ ] **步骤 4：Commit**

```bash
git add server/db.ts
git commit -m "feat(db): 添加 users 表和 operation_logs operator 字段"
```

---

## 任务 3：认证中间件

**文件：**
- 创建：`server/middleware/auth.ts`

- [ ] **步骤 1：创建 auth.ts 中间件文件**

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import db from '../db'

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number
        username: string
        role: string
      }
    }
  }
}

// 获取 JWT_SECRET（从 system_config 读取或自动生成）
function getJwtSecret(): string {
  let secret = (db.prepare("SELECT value FROM system_config WHERE key = 'jwt_secret'").get() as { value: string } | undefined)?.value
  if (!secret) {
    secret = require('crypto').randomBytes(32).toString('hex')
    db.prepare("INSERT OR REPLACE INTO system_config (key, value, description) VALUES (?, ?, ?)").run(
      'jwt_secret',
      secret,
      'JWT 签名密钥（系统自动生成，请勿修改）'
    )
    console.log('[auth] 已自动生成 JWT_SECRET')
  }
  return secret
}

// JWT 校验中间件 — 解析 token，挂载 user 到 req
export function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未登录' })
  }

  const token = authHeader.slice(7)
  try {
    const secret = getJwtSecret()
    const payload = jwt.verify(token, secret) as { id: number; username: string; role: string }
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期' })
  }
}

// 角色校验中间件工厂 — 检查 role 是否在允许列表中
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: 403, message: '无权限访问' })
    }
    next()
  }
}

// 导出获取 secret 的函数供路由使用
export { getJwtSecret }
```

- [ ] **步骤 2：创建 middleware 目录**

```bash
mkdir -p C:/Users/何鑫城/Desktop/OpsHub/server/middleware
```

- [ ] **步骤 3：Commit**

```bash
git add server/middleware/auth.ts
git commit -m "feat: 添加 JWT 认证和角色校验中间件"
```

---

## 任务 4：认证路由 — 登录 + 当前用户 + 修改密码

**文件：**
- 创建：`server/routes/auth.ts`

- [ ] **步骤 1：创建 auth.ts 路由**

```typescript
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db'
import { authRequired, getJwtSecret } from '../middleware/auth'

const router = Router()

// POST /api/v1/auth/login — 登录
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '请输入用户名和密码' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any
  if (!user) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' })
  }

  if (!user.is_active) {
    return res.status(403).json({ code: 403, message: '账号已被禁用' })
  }

  const valid = bcrypt.compareSync(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ code: 401, message: '用户名或密码错误' })
  }

  // 更新最后登录时间
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id)

  // 生成 token
  const secret = getJwtSecret()
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    secret,
    { expiresIn: '24h' }
  )

  res.json({
    code: 200,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    },
  })
})

// GET /api/v1/auth/me — 获取当前用户信息
router.get('/me', authRequired, (req: Request, res: Response) => {
  const user = db.prepare(
    'SELECT id, username, display_name, role, last_login_at FROM users WHERE id = ?'
  ).get(req.user!.id)

  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  res.json({ code: 200, data: user })
})

// PUT /api/v1/auth/password — 修改自己的密码
router.put('/password', authRequired, (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ code: 400, message: '请输入旧密码和新密码' })
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as any
  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  const valid = bcrypt.compareSync(oldPassword, user.password_hash)
  if (!valid) {
    return res.status(401).json({ code: 401, message: '旧密码错误' })
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hash,
    req.user!.id
  )

  res.json({ code: 200, message: '密码修改成功' })
})

export default router
```

- [ ] **步骤 2：Commit**

```bash
git add server/routes/auth.ts
git commit -m "feat: 添加认证路由（登录/当前用户/修改密码）"
```

---

## 任务 5：用户管理路由

**文件：**
- 创建：`server/routes/users.ts`

- [ ] **步骤 1：创建 users.ts 路由**

```typescript
import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db'
import { authRequired, requireRole } from '../middleware/auth'

const router = Router()

// 所有用户管理路由需要登录 + admin 权限
router.use(authRequired, requireRole('admin', 'superadmin'))

// GET /api/v1/users — 用户列表
router.get('/', (req: Request, res: Response) => {
  let users
  if (req.user!.role === 'superadmin') {
    // 超级管理员看到所有用户
    users = db.prepare(
      'SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM users ORDER BY id ASC'
    ).all()
  } else {
    // 管理员只看到普通用户
    users = db.prepare(
      "SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE role = 'user' ORDER BY id ASC"
    ).all()
  }

  res.json({ code: 200, data: users })
})

// POST /api/v1/users — 创建用户
router.post('/', (req: Request, res: Response) => {
  const { username, password, display_name, role } = req.body

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' })
  }

  // 权限检查
  const targetRole = role || 'user'
  if (req.user!.role !== 'superadmin' && targetRole !== 'user') {
    return res.status(403).json({ code: 403, message: '管理员只能创建普通用户' })
  }

  // 检查用户名是否已存在
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    return res.status(409).json({ code: 409, message: '用户名已存在' })
  }

  const hash = bcrypt.hashSync(password, 10)
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
  ).run(username, hash, display_name || '', targetRole)

  const user = db.prepare(
    'SELECT id, username, display_name, role, is_active, created_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid)

  res.status(201).json({ code: 201, data: user })
})

// PUT /api/v1/users/:id — 修改用户
router.put('/:id', (req: Request, res: Response) => {
  const targetId = parseInt(req.params.id)
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any

  if (!target) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  // 权限检查：admin 不能操作 superadmin 和其他 admin
  if (req.user!.role !== 'superadmin' && target.role !== 'user') {
    return res.status(403).json({ code: 403, message: '无权操作此用户' })
  }

  // 不能修改自己的角色（防止降级）
  if (targetId === req.user!.id && req.body.role && req.body.role !== target.role) {
    return res.status(400).json({ code: 400, message: '不能修改自己的角色' })
  }

  const { display_name, role, is_active } = req.body

  // 权限检查：非 superadmin 不能设置 admin/superadmin 角色
  if (req.user!.role !== 'superadmin' && role && role !== 'user') {
    return res.status(403).json({ code: 403, message: '管理员只能设置普通用户角色' })
  }

  const updates: string[] = []
  const values: any[] = []

  if (display_name !== undefined) {
    updates.push('display_name = ?')
    values.push(display_name)
  }
  if (role !== undefined) {
    updates.push('role = ?')
    values.push(role)
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?')
    values.push(is_active ? 1 : 0)
  }

  if (updates.length === 0) {
    return res.status(400).json({ code: 400, message: '缺少要更新的字段' })
  }

  updates.push("updated_at = datetime('now')")
  values.push(targetId)

  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  const user = db.prepare(
    'SELECT id, username, display_name, role, is_active, last_login_at, created_at, updated_at FROM users WHERE id = ?'
  ).get(targetId)

  res.json({ code: 200, data: user })
})

// DELETE /api/v1/users/:id — 删除用户
router.delete('/:id', (req: Request, res: Response) => {
  const targetId = parseInt(req.params.id)
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any

  if (!target) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  // 不能删除自己
  if (targetId === req.user!.id) {
    return res.status(400).json({ code: 400, message: '不能删除自己' })
  }

  // 权限检查
  if (req.user!.role !== 'superadmin' && target.role !== 'user') {
    return res.status(403).json({ code: 403, message: '无权删除此用户' })
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(targetId)
  res.status(204).send()
})

// PUT /api/v1/users/:id/reset-password — 重置密码
router.put('/:id/reset-password', (req: Request, res: Response) => {
  const targetId = parseInt(req.params.id)
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any

  if (!target) {
    return res.status(404).json({ code: 404, message: '用户不存在' })
  }

  // 权限检查
  if (req.user!.role !== 'superadmin' && target.role !== 'user') {
    return res.status(403).json({ code: 403, message: '无权重置此用户密码' })
  }

  const { newPassword } = req.body
  if (!newPassword) {
    return res.status(400).json({ code: 400, message: '新密码不能为空' })
  }

  const hash = bcrypt.hashSync(newPassword, 10)
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    hash,
    targetId
  )

  res.json({ code: 200, message: '密码重置成功' })
})

export default router
```

- [ ] **步骤 2：Commit**

```bash
git add server/routes/users.ts
git commit -m "feat: 添加用户管理路由（CRUD + 权限控制）"
```

---

## 任务 6：注册路由 + 添加中间件保护

**文件：**
- 修改：`server/index.ts`

- [ ] **步骤 1：添加 import**

在 `import logMonitorRouter from './routes/log-monitor'` 之后添加：

```typescript
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import { authRequired, requireRole } from './middleware/auth'
```

- [ ] **步骤 2：注册认证和用户管理路由**

在 `app.use('/api/v1/log-monitor', logMonitorRouter)` 之前添加：

```typescript
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)
```

- [ ] **步骤 3：为 admin 路由添加认证保护**

将 `app.use('/api/v1/admin', adminRouter)` 修改为：

```typescript
app.use('/api/v1/admin', authRequired, requireRole('admin', 'superadmin'), adminRouter)
```

- [ ] **步骤 4：Commit**

```bash
git add server/index.ts
git commit -m "feat: 注册认证和用户管理路由，admin 路由添加认证保护"
```

---

## 任务 7：操作日志记录操作人

**文件：**
- 修改：`server/routes/admin.ts`

- [ ] **步骤 1：修改 logOperation 函数**

将现有 `logOperation` 函数：

```typescript
function logOperation(module: string, action: string, target: string, detail: string = '') {
  db.prepare(
    'INSERT INTO operation_logs (module, action, target, detail) VALUES (?, ?, ?, ?)'
  ).run(module, action, target, detail)
}
```

修改为（添加可选的 operator 参数）：

```typescript
function logOperation(module: string, action: string, target: string, detail: string = '', operator: string = '') {
  db.prepare(
    'INSERT INTO operation_logs (module, action, target, detail, operator) VALUES (?, ?, ?, ?, ?)'
  ).run(module, action, target, detail, operator)
}
```

- [ ] **步骤 2：在路由中使用操作人信息**

修改 admin.ts 中所有调用 `logOperation` 的地方，从 `req.user?.username || ''` 获取操作人。

例如将：
```typescript
logOperation(config.module, '新增', String(req.body.name || ''), JSON.stringify(req.body))
```

修改为：
```typescript
logOperation(config.module, '新增', String(req.body.name || ''), JSON.stringify(req.body), req.user?.username || '')
```

对所有 `logOperation` 调用做同样修改（在 '新增'、'修改'、'删除'、'修改' 配置、'清空日志' 处）。

- [ ] **步骤 3：Commit**

```bash
git add server/routes/admin.ts
git commit -m "feat: 操作日志记录操作人用户名"
```

---

## 任务 8：前端 API 封装

**文件：**
- 创建：`src/api/auth.ts`
- 创建：`src/api/users.ts`
- 修改：`src/api/request.ts`

- [ ] **步骤 1：创建 src/api/auth.ts**

```typescript
import request from './request'

export interface UserInfo {
  id: number
  username: string
  display_name: string
  role: 'superadmin' | 'admin' | 'user'
  last_login_at?: string
}

export interface LoginResponse {
  token: string
  user: UserInfo
}

export function login(username: string, password: string) {
  return request.post<any, LoginResponse>('/auth/login', { username, password })
}

export function getMe() {
  return request.get<any, UserInfo>('/auth/me')
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request.put<any, any>('/auth/password', { oldPassword, newPassword })
}
```

- [ ] **步骤 2：创建 src/api/users.ts**

```typescript
import request from './request'
import type { UserInfo } from './auth'

export interface CreateUserParams {
  username: string
  password: string
  display_name: string
  role: 'superadmin' | 'admin' | 'user'
}

export interface UpdateUserParams {
  display_name?: string
  role?: 'superadmin' | 'admin' | 'user'
  is_active?: boolean
}

export function fetchUsers() {
  return request.get<any, UserInfo[]>('/users')
}

export function createUser(data: CreateUserParams) {
  return request.post<any, UserInfo>('/users', data)
}

export function updateUser(id: number, data: UpdateUserParams) {
  return request.put<any, UserInfo>(`/users/${id}`, data)
}

export function deleteUser(id: number) {
  return request.delete(`/users/${id}`)
}

export function resetPassword(id: number, newPassword: string) {
  return request.put<any, any>(`/users/${id}/reset-password`, { newPassword })
}
```

- [ ] **步骤 3：修改 src/api/request.ts — 添加请求拦截器**

在现有 `instance.interceptors.request.use` 中添加 Authorization header。如果没有请求拦截器，添加一个新的：

```typescript
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

在现有响应拦截器中，添加 401 处理：

```typescript
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

- [ ] **步骤 4：Commit**

```bash
git add src/api/auth.ts src/api/users.ts src/api/request.ts
git commit -m "feat: 添加前端认证和用户管理 API 封装"
```

---

## 任务 9：认证状态管理 Store

**文件：**
- 创建：`src/stores/auth.ts`

- [ ] **步骤 1：创建 auth store**

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ElMessage } from 'element-plus'
import { login as apiLogin, getMe, type UserInfo } from '../api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'superadmin')
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')

  async function login(username: string, password: string) {
    const data = await apiLogin(username, password)
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
  }

  async function fetchMe() {
    try {
      user.value = await getMe()
    } catch {
      logout()
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    login,
    logout,
    fetchMe,
  }
})
```

- [ ] **步骤 2：Commit**

```bash
git add src/stores/auth.ts
git commit -m "feat: 添加用户认证状态管理 store"
```

---

## 任务 10：登录页面

**文件：**
- 创建：`src/views/LoginView.vue`

- [ ] **步骤 1：创建登录页面组件**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    await auth.login(username.value, password.value)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">OpsHub</h1>
      <p class="login-subtitle">运维管理平台</p>

      <el-form @submit.prevent="handleLogin" class="login-form">
        <el-form-item>
          <el-input
            v-model="username"
            placeholder="用户名"
            size="large"
            :prefix-icon="UserIcon"
          />
        </el-form-item>

        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="密码"
            size="large"
            :prefix-icon="LockIcon"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-button
          type="primary"
          size="large"
          :loading="loading"
          @click="handleLogin"
          style="width: 100%"
        >
          登录
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<script lang="ts">
import { User as UserIcon, Lock as LockIcon } from '@element-plus/icons-vue'

export default {
  components: { UserIcon, LockIcon },
  data() {
    return { UserIcon, LockIcon }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ops-bg-page, #0d1117);
}

.login-card {
  width: 360px;
  padding: 40px;
  background: var(--ops-bg-card, #161b22);
  border: 1px solid var(--ops-border-card, #30363d);
  border-radius: 12px;
}

.login-title {
  text-align: center;
  font-size: 28px;
  font-weight: 600;
  color: var(--ops-text-primary, #e6edf3);
  margin: 0 0 4px;
}

.login-subtitle {
  text-align: center;
  font-size: 14px;
  color: var(--ops-text-tertiary, #7d8590);
  margin: 0 0 32px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/views/LoginView.vue
git commit -m "feat: 添加登录页面"
```

---

## 任务 11：路由守卫 + 登录路由

**文件：**
- 修改：`src/router/index.ts`

- [ ] **步骤 1：添加登录路由**

在 `routes` 数组中添加（在 admin 路由之前）：

```typescript
{
  path: '/login',
  name: 'login',
  component: () => import('../views/LoginView.vue'),
  meta: { title: '登录' },
},
```

- [ ] **步骤 2：添加 beforeEach 路由守卫**

在 `router.afterEach` 之前添加：

```typescript
router.beforeEach(async (to) => {
  const { useAuthStore } = await import('../stores/auth')
  const auth = useAuthStore()

  // 未登录且目标不是登录页 → 跳转登录
  if (!auth.isLoggedIn && to.path !== '/login') {
    return '/login'
  }

  // 已登录访问登录页 → 跳转首页
  if (auth.isLoggedIn && to.path === '/login') {
    return '/'
  }

  // /admin/** 需要管理员权限
  if (to.path.startsWith('/admin') && !auth.isAdmin) {
    return '/'
  }
})
```

- [ ] **步骤 3：Commit**

```bash
git add src/router/index.ts
git commit -m "feat: 添加路由守卫和登录路由"
```

---

## 任务 12：用户管理页面

**文件：**
- 创建：`src/views/admin/AdminUsers.vue`

- [ ] **步骤 1：创建用户管理页面**

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchUsers, createUser, updateUser, deleteUser, resetPassword } from '../../api/users'
import type { UserInfo } from '../../api/auth'

const auth = useAuthStore()
const users = ref<UserInfo[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const resetDialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({ username: '', password: '', display_name: '', role: 'user' as string })
const resetForm = ref({ userId: 0, userName: '', newPassword: '' })

const roleLabels: Record<string, string> = {
  superadmin: '超级管理员',
  admin: '管理员',
  user: '普通用户',
}

const roleTagType: Record<string, string> = {
  superadmin: 'danger',
  admin: '',
  user: 'info',
}

const availableRoles = computed(() => {
  if (auth.isSuperAdmin) {
    return [
      { label: '管理员', value: 'admin' },
      { label: '普通用户', value: 'user' },
    ]
  }
  return [{ label: '普通用户', value: 'user' }]
})

async function loadUsers() {
  loading.value = true
  try {
    users.value = await fetchUsers()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

function handleAdd() {
  isEdit.value = false
  form.value = { username: '', password: '', display_name: '', role: 'user' }
  dialogVisible.value = true
}

function handleEdit(user: UserInfo) {
  isEdit.value = true
  form.value = {
    username: user.username,
    password: '',
    display_name: user.display_name,
    role: user.role,
  }
  editingUser.value = user
  dialogVisible.value = true
}

const editingUser = ref<UserInfo | null>(null)

async function handleSubmit() {
  try {
    if (isEdit.value && editingUser.value) {
      await updateUser(editingUser.value.id, {
        display_name: form.value.display_name,
        role: form.value.role as any,
      })
      ElMessage.success('修改成功')
    } else {
      await createUser({
        username: form.value.username,
        password: form.value.password,
        display_name: form.value.display_name,
        role: form.value.role as any,
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadUsers()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function handleToggleStatus(user: UserInfo) {
  try {
    await updateUser(user.id, { is_active: !user.is_active })
    ElMessage.success(user.is_active ? '已禁用' : '已启用')
    loadUsers()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  }
}

async function handleDelete(user: UserInfo) {
  try {
    await ElMessageBox.confirm(`确定删除用户「${user.display_name || user.username}」？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteUser(user.id)
    ElMessage.success('删除成功')
    loadUsers()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

function handleResetPassword(user: UserInfo) {
  resetForm.value = { userId: user.id, userName: user.display_name || user.username, newPassword: '' }
  resetDialogVisible.value = true
}

async function handleResetSubmit() {
  if (!resetForm.value.newPassword) {
    ElMessage.warning('请输入新密码')
    return
  }
  try {
    await resetPassword(resetForm.value.userId, resetForm.value.newPassword)
    ElMessage.success('密码重置成功')
    resetDialogVisible.value = false
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '重置失败')
  }
}

function formatTime(time: string | null | undefined) {
  if (!time) return '-'
  return time.replace('T', ' ').slice(0, 16)
}
</script>

<template>
  <div class="users-page">
    <div class="page-header">
      <div class="header-left">
        <span class="page-title">用户管理</span>
        <span class="total-text">{{ users.length }} 个用户</span>
      </div>
      <el-button type="primary" size="small" @click="handleAdd">新增用户</el-button>
    </div>

    <el-table :data="users" v-loading="loading" size="small">
      <el-table-column prop="username" label="用户名" width="150" />
      <el-table-column prop="display_name" label="显示名称" width="150" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="roleTagType[row.role] as any" size="small">
            {{ roleLabels[row.role] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
            {{ row.is_active ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最后登录" width="150">
        <template #default="{ row }">
          <span class="cell-time">{{ formatTime(row.last_login_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" min-width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" text size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button type="warning" text size="small" @click="handleResetPassword(row)">重置密码</el-button>
          <el-button
            :type="row.is_active ? 'warning' : 'success'"
            text size="small"
            @click="handleToggleStatus(row)"
          >
            {{ row.is_active ? '禁用' : '启用' }}
          </el-button>
          <el-button type="danger" text size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '新增用户'"
      width="420px"
      destroy-on-close
    >
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名" v-if="!isEdit" required>
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" v-if="!isEdit" required>
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="form.display_name" placeholder="请输入显示名称" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option
              v-for="opt in availableRoles"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">{{ isEdit ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="resetDialogVisible" title="重置密码" width="380px" destroy-on-close>
      <p style="margin-bottom: 16px; color: var(--ops-text-secondary);">
        为「{{ resetForm.userName }}」设置新密码
      </p>
      <el-form-item label="新密码">
        <el-input
          v-model="resetForm.newPassword"
          type="password"
          placeholder="请输入新密码"
          show-password
        />
      </el-form-item>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleResetSubmit">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
  width: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.page-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--ops-text-primary);
}

.total-text {
  font-size: 12px;
  color: var(--ops-text-tertiary);
}

.cell-time {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  font-variant-numeric: tabular-nums;
}
</style>
```

- [ ] **步骤 2：Commit**

```bash
git add src/views/admin/AdminUsers.vue
git commit -m "feat: 添加用户管理页面"
```

---

## 任务 13：侧栏菜单添加用户管理入口

**文件：**
- 修改：`src/views/admin/AdminView.vue`

- [ ] **步骤 1：在侧栏菜单中添加用户管理入口**

在 AdminView.vue 的菜单列表中，在"操作日志"菜单项之前添加：

```vue
<el-menu-item index="/admin/users">
  <el-icon><User /></el-icon>
  <span>用户管理</span>
</el-menu-item>
```

确保引入了 `User` 图标（从 `@element-plus/icons-vue`）。

- [ ] **步骤 2：Commit**

```bash
git add src/views/admin/AdminView.vue
git commit -m "feat: 侧栏菜单添加用户管理入口"
```

---

## 任务 14：TypeScript 编译验证

- [ ] **步骤 1：运行 TypeScript 编译检查**

```bash
cd C:/Users/何鑫城/Desktop/OpsHub
npx vue-tsc --noEmit
```

预期：无错误或仅有与本次改动无关的警告

- [ ] **步骤 2：修复发现的类型问题**

如果编译失败，根据错误信息修复类型问题（如 Request 类型扩展、Pinia store 类型等）。

- [ ] **步骤 3：最终 Commit**

```bash
git add -A
git commit -m "fix: 修复 TypeScript 编译问题"
```

---

## 计划自检

### 规格覆盖度

- ✅ users 表 + 初始化默认管理员 → 任务 2
- ✅ JWT 认证中间件 → 任务 3
- ✅ 登录/当前用户/修改密码 API → 任务 4
- ✅ 用户管理 CRUD API + 权限控制 → 任务 5
- ✅ 路由保护 → 任务 6
- ✅ 操作日志记录操作人 → 任务 7
- ✅ 前端 API 封装 + 请求拦截 → 任务 8
- ✅ 认证状态管理 Store → 任务 9
- ✅ 登录页面 → 任务 10
- ✅ 路由守卫 → 任务 11
- ✅ 用户管理页面 → 任务 12
- ✅ 侧栏菜单入口 → 任务 13
- ✅ TypeScript 验证 → 任务 14
- ✅ operation_logs.operator 字段 → 任务 2

### 占位符检查

无 TODO、无"待定"、无"后续实现"。

### 类型一致性

- `UserInfo` 在 `auth.ts` 中定义，`users.ts` 中导入使用
- `LoginResponse` 在 `auth.ts` 中定义
- `CreateUserParams` 和 `UpdateUserParams` 在 `users.ts` 中定义
- JWT payload 结构 `{ id, username, role }` 在中间件和登录路由中一致
