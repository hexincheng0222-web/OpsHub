# 话机备注转移到详情抽屉 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将话机备注的编辑入口从后台字典页面（`/admin/phone-remarks`）转移到话机管理页面（`/phones`）的详情抽屉，并删除后台字典入口。

**架构：** 详情抽屉新增「📝 备注」区块（显示/编辑态切换），调用新增的 `PUT /api/v1/phones/:id/remark` API，后端按分机号 UPSERT 到现有 `phone_remarks` 表。后台字典入口（路由/菜单/字典配置）完全删除。

**技术栈：** Vue 3 Composition API + Element Plus + Express + better-sqlite3

---

## 文件结构

**修改：**
- `src/views/PhonesView.vue` — 详情抽屉新增备注区块（显示/编辑态）
- `src/api/phones.ts` — 新增 `updatePhoneRemark(id, remark)` API
- `server/routes/phones.ts` — 新增 `PUT /:id/remark` 路由
- `src/router/index.ts` — 删除 `phone-remarks` 路由条目
- `src/views/admin/AdminView.vue` — 删除侧栏「话机备注」菜单项
- `src/utils/admin-dict-config.ts` — 删除 `'phone-remarks'` 字典配置块

**不动：**
- `server/db.ts` 的 `phone_remarks` 表结构（保留数据）
- `server/routes/phones.ts` 的 `GET /` 里读取备注逻辑（前台表格还要显示）

---

### 任务 1：后端新增 `PUT /:id/remark` 路由

**文件：**
- 修改：`server/routes/phones.ts`（在 `router.post('/:id/reboot', ...)` 之后插入新路由）

- [ ] **步骤 1：实现 PUT /:id/remark 路由**

在 `server/routes/phones.ts` 中，找到 `router.post('/:id/reboot', ...)` 路由块（约 414-427 行）的结束 `})` 之后，插入以下新路由：

```ts
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
    logOp('话机管理', '修改备注', phone.extension, remark ? `备注已更新：${remark.slice(0, 50)}` : '备注已清空')
    res.json({ code: 200, data: { extension: phone.extension, remark } })
  } catch (err: any) {
    console.error('[server] 修改话机备注失败:', err.message)
    res.status(500).json({ code: 500, message: err.message || '保存失败' })
  }
})
```

说明：
- 复用现有 `cache` 全局变量查找话机（与 account、reboot 路由一致）
- 复用现有 `logOp(module, action, target, detail)` 函数
- UPSERT 用 SQLite 的 `INSERT ... ON CONFLICT(extension) DO UPDATE`（phone_remarks 表已有 `UNIQUE(extension)` 约束）
- `remark.slice(0, 500)` 限制长度防滥用（TEXT 字段无硬限制）

- [ ] **步骤 2：启动后端验证路由可加载**

运行：`cd server && npx tsx watch index.ts`（或项目根 `npm run dev:server`）
预期：服务启动无报错，控制台无 TypeScript 编译错误

- [ ] **步骤 3：手动验证 API**

运行（替换 `<id>` 为实际话机 id）：
```bash
curl -X PUT http://localhost:3001/api/v1/phones/<id>/remark \
  -H "Content-Type: application/json" \
  -d '{"remark":"测试备注"}'
```
预期：返回 `{ "code": 200, "data": { "extension": "...", "remark": "测试备注" } }`
再查数据库确认 `phone_remarks` 表对应 extension 行的 `remark` 字段已更新。

- [ ] **步骤 4：Commit**

```bash
git add server/routes/phones.ts
git commit -m "feat(backend): 新增 PUT /phones/:id/remark 路由，支持话机备注编辑"
```

---

### 任务 2：前端新增 `updatePhoneRemark` API

**文件：**
- 修改：`src/api/phones.ts`

- [ ] **步骤 1：在文件末尾追加 API 函数**

在 `src/api/phones.ts` 文件末尾（`rebootPhone` 函数之后）追加：

```ts
/** 修改话机备注 */
export async function updatePhoneRemark(id: string, remark: string) {
  return request<any>(`${BASE}/${id}/remark`, {
    method: 'PUT',
    body: JSON.stringify({ remark }),
  })
}
```

- [ ] **步骤 2：Commit**

```bash
git add src/api/phones.ts
git commit -m "feat(frontend): 新增 updatePhoneRemark API 封装"
```

---

### 任务 3：PhonesView 详情抽屉新增备注区块

**文件：**
- 修改：`src/views/PhonesView.vue`

- [ ] **步骤 1：import 新增 `updatePhoneRemark`**

修改 `src/views/PhonesView.vue` 第 153 行的 import 语句：

旧：
```ts
import { fetchPhones, fetchPhoneDetail, updatePhoneAccount, rebootPhone as rebootPhoneApi } from '@/api/phones'
```

新：
```ts
import { fetchPhones, fetchPhoneDetail, updatePhoneAccount, updatePhoneRemark, rebootPhone as rebootPhoneApi } from '@/api/phones'
```

- [ ] **步骤 2：在详情抽屉模板中插入备注区块**

在 `src/views/PhonesView.vue` 的详情抽屉模板中，找到「📦 基本信息」section 的结束 `</div>`（约第 101 行，即 `</div>` 闭合 `detail-section`），在其后、「📞 账号配置」section（第 102 行）之前，插入以下新 section：

```html
        <div class="detail-section">
          <div class="detail-title">📝 备注 <el-button v-if="!remarkEditing" link type="primary" size="small" @click="startRemarkEdit">编辑</el-button></div>
          <template v-if="remarkEditing">
            <el-input v-model="remarkForm" type="textarea" :rows="2" maxlength="200" show-word-limit size="small" />
            <div style="margin-top:8px;display:flex;gap:8px">
              <el-button type="primary" size="small" @click="saveRemark" :loading="remarkSaving">保存</el-button>
              <el-button size="small" @click="remarkEditing = false">取消</el-button>
            </div>
          </template>
          <template v-else>
            <div class="detail-row"><span class="detail-label">备注内容</span><span class="detail-value" :class="{ muted: !selectedPhone?.remark }">{{ selectedPhone?.remark || '—' }}</span></div>
          </template>
        </div>
```

- [ ] **步骤 3：在 script 中新增备注编辑状态与函数**

在 `src/views/PhonesView.vue` 的 `<script setup>` 中，找到账号配置编辑相关代码块（`const editing = ref(false)` 附近，约第 185 行），在其后插入以下代码：

```ts
// 备注编辑
const remarkEditing = ref(false)
const remarkSaving = ref(false)
const remarkForm = ref('')

function startRemarkEdit() {
  remarkForm.value = selectedPhone.value?.remark || ''
  remarkEditing.value = true
}

async function saveRemark() {
  remarkSaving.value = true
  try {
    await updatePhoneRemark(selectedPhone.value.id, remarkForm.value)
    // 更新选中话机对象 + 表格对应行的 remark
    selectedPhone.value.remark = remarkForm.value
    const row = devices.value.find((d: any) => d.id === selectedPhone.value.id)
    if (row) row.remark = remarkForm.value
    remarkEditing.value = false
    ElMessage.success('备注已保存')
    // 记录操作日志（不影响主流程）
    request('/api/v1/admin/logs', { method: 'POST', body: JSON.stringify({ module: 'phones', action: 'update_remark', detail: `话机 ${selectedPhone.value.extension} 备注已更新` }) }).catch(() => {})
  } catch (e: any) {
    ElMessage.error(e.message || '保存失败')
  } finally {
    remarkSaving.value = false
  }
}
```

说明：
- 保存成功后同步更新 `selectedPhone.remark` 和表格 `devices` 数组中对应行的 `remark`，避免整表刷新
- 复用现有 `request` 工具记录操作日志（与 `saveAccount` 一致的模式）

- [ ] **步骤 4：启动前端验证渲染**

运行：`npm run dev:client`
预期：打开 `/phones`，点击任一话机「详情」按钮，抽屉中「基本信息」与「账号配置」之间出现「📝 备注」区块，显示当前备注或 `—`，有「编辑」按钮。

- [ ] **步骤 5：手动验证编辑流程**

在浏览器中：
1. 点击「编辑」→ 出现 textarea + 保存/取消按钮
2. 输入备注文本 → 点击「保存」
3. 验证：退出编辑态、备注内容更新、表格中该行备注列同步更新、出现「备注已保存」提示
4. 再次打开同一话机详情，备注内容持久化

- [ ] **步骤 6：Commit**

```bash
git add src/views/PhonesView.vue
git commit -m "feat(frontend): 话机详情抽屉新增备注编辑区块"
```

---

### 任务 4：删除后台字典入口（路由 + 菜单 + 字典配置）

**文件：**
- 修改：`src/router/index.ts`
- 修改：`src/views/admin/AdminView.vue`
- 修改：`src/utils/admin-dict-config.ts`

- [ ] **步骤 1：删除路由条目**

在 `src/router/index.ts` 中找到第 106 行：

旧：
```ts
        { path: 'phone-remarks', name: 'AdminPhoneRemarks', component: () => import('../views/admin/AdminDictTable.vue'), meta: { dict: 'phone-remarks', title: '话机备注' } },
```

删除这一行（注意保留前后行的逗号/格式正确）。

- [ ] **步骤 2：删除侧栏菜单项**

在 `src/views/admin/AdminView.vue` 中找到第 62 行：

旧：
```ts
      { key: 'phone-remarks', label: '话机备注', route: '/admin/phone-remarks' },
```

删除这一行。

- [ ] **步骤 3：删除字典配置块**

在 `src/utils/admin-dict-config.ts` 中找到第 141-147 行的 `'phone-remarks'` 整块：

旧：
```ts
  'phone-remarks': {
    title: '话机备注',
    columns: [
      { prop: 'extension', label: '分机号', type: 'text', required: true },
      { prop: 'remark', label: '备注', type: 'textarea' },
    ],
  },
```

删除整个块（包括末尾逗号）。

- [ ] **步骤 4：验证编译与运行**

运行：`npm run dev:client`
预期：
- 前端编译无报错
- 后台侧栏不再出现「话机备注」菜单项
- 访问 `/admin/phone-remarks` 路由应 404 或跳转 NotFound（因为路由已删）

- [ ] **步骤 5：Commit**

```bash
git add src/router/index.ts src/views/admin/AdminView.vue src/utils/admin-dict-config.ts
git commit -m "refactor(admin): 移除后台话机备注字典入口，备注迁移至话机详情"
```

---

## 自检结果

**规格覆盖度：**
- ✅ 详情抽屉编辑备注 → 任务 3
- ✅ 新增 API → 任务 2
- ✅ 新增后端路由 + UPSERT + 操作日志 → 任务 1
- ✅ 删除后台字典入口（路由/菜单/字典配置）→ 任务 4
- ✅ 保留 `phone_remarks` 表 + `GET /phones` 读取逻辑 → 未改动，符合规格
- ✅ 错误处理：保存失败 ElMessage.error + 编辑态保留 → 任务 3 步骤 3 的 catch 块

**占位符扫描：** 无 TODO/待定，所有代码块完整。

**类型一致性：** `updatePhoneRemark(id, remark)` 在任务 2 定义、任务 3 调用，签名一致。`phone.remark` 字段在 `PhoneDevice` 接口已存在（`src/api/phones.ts:19`），任务 3 中 `selectedPhone.value.remark` 与 `row.remark` 访问一致。
