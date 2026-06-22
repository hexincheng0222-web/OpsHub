# OpsHub 账号系统设计规格

## 概述

为 OpsHub 运维管理平台添加基于 JWT 的用户认证和角色权限系统，实现后台访问控制。

**核心需求：**
- 三种角色：超级管理员（superadmin）、管理员（admin）、用户（user）
- 超级管理员可管理所有账号（增删改查管理员和用户）
- 管理员只能管理普通用户账号
- 只有超级管理员和管理员能访问后台管理页面
- 普通用户仅能访问前台页面

**技术选型：**
- 认证方式：JWT Token（单 Token，24 小时有效）
- 密码加密：bcryptjs
- 账号创建：仅后台创建，不开放注册
- 密码策略：最低要求（内网使用）

---

## 数据库设计

### 新增 users 表

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,       -- 登录用户名
  password_hash TEXT NOT NULL,          -- bcrypt 加密后的密码
  display_name TEXT NOT NULL DEFAULT '', -- 显示名称
  role TEXT NOT NULL DEFAULT 'user',    -- 角色：superadmin / admin / user
  is_active INTEGER NOT NULL DEFAULT 1, -- 是否启用（1=启用, 0=禁用）
  last_login_at TEXT,                   -- 最后登录时间
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

### 角色权限矩阵

| 能力 | superadmin | admin | user |
|------|-----------|-------|------|
| 访问后台 | ✅ | ✅ | ❌ |
| 用户管理（查看） | 所有用户 | 仅 role=user | - |
| 用户管理（增删改） | 所有用户 | 仅 role=user | - |
| 字典/业务数据管理 | ✅ | ✅ | - |
| 前台页面访问 | ✅ | ✅ | ✅ |

### 初始化数据

系统首次启动时自动创建默认超级管理员：
- 用户名：`admin`
- 密码：`admin123`
- 角色：`superadmin`
- 如果 `users` 表为空则自动插入

### operation_logs 表修改

新增字段：
```sql
ALTER TABLE operation_logs ADD COLUMN operator TEXT NOT NULL DEFAULT '';
```
用于记录操作人用户名，从 JWT token 中提取。

---

## 后端设计

### 依赖包

```json
{
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "@types/bcryptjs": "^2.4.6",
  "@types/jsonwebtoken": "^9.0.7"
}
```

### 环境变量

在 `server/` 目录下新增 `.env` 或使用 `system_config` 存储：
- `JWT_SECRET` — JWT 签名密钥（随机生成，首次启动时自动写入 system_config）

### API 接口

#### 认证接口

**POST /api/v1/auth/login**
```
请求：{ username: string, password: string }
响应：{
  code: 200,
  data: {
    token: string,       // JWT token（有效期 24h）
    user: { id, username, display_name, role }
  }
}
错误：401 用户名或密码错误 / 403 账号已禁用
```

**GET /api/v1/auth/me**
```
请求头：Authorization: Bearer <token>
响应：{
  code: 200,
  data: { id, username, display_name, role, last_login_at }
}
```

**PUT /api/v1/auth/password**
```
请求头：Authorization: Bearer <token>
请求：{ oldPassword: string, newPassword: string }
响应：{ code: 200, message: '密码修改成功' }
```

#### 用户管理接口（需 admin+ 权限）

**GET /api/v1/users**
```
权限：admin+
响应：{ code: 200, data: User[] }
注意：
  - superadmin 返回所有用户
  - admin 只返回 role=user 的用户
  - 不返回 password_hash 字段
```

**POST /api/v1/users**
```
权限：admin+
请求：{ username, password, display_name, role }
注意：
  - admin 只能创建 role=user
  - superadmin 可创建 admin 和 user
  - password 用 bcryptjs 加密存储
响应：201 + 创建的用户信息
```

**PUT /api/v1/users/:id**
```
权限：admin+
请求：{ display_name?, role?, is_active? }
注意：
  - admin 只能修改 role=user 的用户
  - superadmin 可修改所有用户
  - 不能修改自己的 role（防止降级）
响应：200 + 更新后的用户信息
```

**DELETE /api/v1/users/:id**
```
权限：admin+
注意：
  - admin 只能删除 role=user 的用户
  - 不能删除自己
  - superadmin 可删除除自己外的所有用户
响应：204
```

**PUT /api/v1/users/:id/reset-password**
```
权限：admin+
请求：{ newPassword: string }
注意：
  - admin 只能重置 role=user 的密码
  - superadmin 可重置所有人的密码
响应：200
```

### 中间件设计

新建 `server/middleware/auth.ts`：

```typescript
// JWT 校验中间件 — 解析 token，挂载 user 到 req
export function authRequired(req, res, next)

// 角色校验中间件工厂 — 检查 role 是否在允许列表中
export function requireRole(...roles: string[])
```

**路由保护：**
- `/api/v1/admin/**` — 需要 `requireRole('admin', 'superadmin')`
- `/api/v1/users/**` — 需要 `requireRole('admin', 'superadmin')`
- `/api/v1/auth/login` — 公开
- 其他业务 API 暂不加认证（后续可按需添加）

### 操作日志改造

修改 `server/routes/admin.ts` 中的 `logOperation` 函数：
- 从 `req.user`（JWT 解析后挂载）中获取 `username`
- 写入 `operation_logs.operator` 字段

---

## 前端设计

### 登录页 `/login`

简洁居中卡片式登录表单：
- 顶部：系统名称「OpsHub」
- 用户名输入框
- 密码输入框
- 登录按钮
- 底部错误提示

### 新增文件

| 文件路径 | 职责 |
|---------|------|
| `src/views/LoginView.vue` | 登录页面 |
| `src/stores/auth.ts` | 用户认证状态管理 |
| `src/views/admin/AdminUsers.vue` | 用户管理页面 |
| `src/api/auth.ts` | 认证相关 API 封装 |
| `src/api/users.ts` | 用户管理 API 封装 |

### 修改文件

| 文件路径 | 修改内容 |
|---------|---------|
| `src/router/index.ts` | 添加登录路由 + beforeEach 守卫 |
| `src/App.vue` 或布局组件 | 未登录时隐藏导航 / 登录页独立布局 |
| `src/api/request.ts` | 请求拦截器添加 Authorization header |

### auth Store 设计

```typescript
// src/stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string>(localStorage.getItem('token') || '')

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin' || user.value?.role === 'superadmin')
  const isSuperAdmin = computed(() => user.value?.role === 'superadmin')

  async function login(username, password) { ... }
  function logout() { ... }
  async function fetchMe() { ... }
})
```

### 路由守卫

```typescript
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // 未登录 → 只允许访问 /login
  if (!auth.isLoggedIn && to.path !== '/login') {
    return '/login'
  }

  // 已登录访问 /login → 跳转首页
  if (auth.isLoggedIn && to.path === '/login') {
    return '/'
  }

  // /admin/** 需要管理员权限
  if (to.path.startsWith('/admin') && !auth.isAdmin) {
    ElMessage.warning('无权限访问后台')
    return '/'
  }
})
```

### 用户管理页面

独立页面 `AdminUsers.vue`（不复用字典表组件，因为需要密码和角色管理）：

- 顶部：标题 + 新增用户按钮
- 表格列：用户名、显示名称、角色（Tag）、状态、最后登录、操作（编辑/重置密码/删除）
- 新增对话框：用户名、密码、显示名称、角色选择
- 编辑对话框：显示名称、角色选择、启用/禁用开关
- 重置密码对话框：新密码输入

角色显示样式：
- `superadmin` — 红色 Tag
- `admin` — 蓝色 Tag
- `user` — 灰色 Tag

### API 请求拦截

在 `src/api/request.ts` 中添加：
```typescript
instance.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // token 过期或无效，清除状态跳转登录
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

---

## 测试要点

### 后端测试
1. 登录：正确凭证返回 token，错误凭证返回 401
2. JWT 校验：无 token 访问 admin 路由返回 401
3. 角色限制：user 角色访问 admin 路由返回 403
4. 用户管理：admin 不能操作 superadmin 账号
5. 自我保护：不能删除自己、不能修改自己的角色

### 前端测试
1. 登录流程：登录 → 获取 token → 跳转首页
2. 路由守卫：未登录 → 跳转 /login；user 访问 /admin → 拦截
3. 用户管理：根据当前角色显示不同的可管理用户范围
4. Token 过期：401 响应 → 自动跳转登录页

---

## 实现优先级

建议按以下顺序实现：

1. 后端：users 表 + JWT 中间件 + auth 路由（登录接口）
2. 后端：用户管理 CRUD 路由 + 权限控制
3. 前端：auth store + 登录页面 + API 拦截器
4. 前端：路由守卫 + 后台页面访问控制
5. 前端：用户管理页面
6. 改造操作日志记录操作人
7. 集成测试
