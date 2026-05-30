# 内网服务页面重设计实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 重新设计内网服务页面，采用干净的全页面布局，添加右侧抽屉面板显示服务详情

**架构：** 单文件修改，仅涉及 `src/views/ServicesView.vue`，保留现有数据逻辑，更新模板和样式

**技术栈：** Vue 3 + Element Plus + CSS3

---

## 文件结构

- **修改：** `src/views/ServicesView.vue` — 更新模板结构、添加抽屉组件、更新样式

---

### 任务 1：更新页面顶部布局

**文件：**
- 修改：`src/views/ServicesView.vue:1-45` — 更新模板顶部结构

- [ ] **步骤 1：更新模板顶部结构**

在 `src/views/ServicesView.vue` 中，找到 `<template>` 开头到 `<!-- 骨架屏` 之前的部分（约第 1-46 行），替换为：

```vue
<template>
  <div class="services-page">
    <el-breadcrumb separator=">" class="breadcrumb-nav">
      <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
      <el-breadcrumb-item>内网服务管理</el-breadcrumb-item>
    </el-breadcrumb>
    <div class="top-bar">
      <h3>内网服务管理</h3>
      <div class="top-actions">
        <el-button
          :type="servicesStore.checking ? 'warning' : 'default'"
          :loading="servicesStore.checking"
          @click="servicesStore.checkAllServices()"
        >
          <el-icon><Refresh /></el-icon>
          {{ servicesStore.checking ? '检测中...' : '检测连通性' }}
        </el-button>
        <el-button type="primary" @click="openAddDialog">
          <el-icon><Plus /></el-icon> 添加服务
        </el-button>
      </div>
    </div>

    <!-- 搜索/筛选栏 -->
    <div class="filter-bar">
      <el-input
        v-model="search"
        placeholder="搜索服务名称、描述或地址..."
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filterCategory" placeholder="全部分类" clearable class="filter-select">
        <el-option v-for="cat in SERVICE_CATEGORIES" :key="cat" :label="cat" :value="cat" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="全部状态" clearable class="filter-select">
        <el-option label="在线" value="online" />
        <el-option label="离线" value="offline" />
        <el-option label="维护中" value="maintenance" />
      </el-select>
      <span v-if="filteredCount" class="result-count">共 {{ filteredCount }} 个</span>
    </div>
```

- [ ] **步骤 2：验证模板语法**

运行：`npm run dev`
预期：页面正常显示，无编译错误

- [ ] **步骤 3：Commit**

```bash
git add src/views/ServicesView.vue
git commit -m "refactor(services): 更新页面顶部布局结构"
```

---

### 任务 2：更新卡片网格和卡片结构

**文件：**
- 修改：`src/views/ServicesView.vue:76-106` — 更新卡片网格和卡片结构

- [ ] **步骤 1：更新卡片网格和卡片结构**

在 `src/views/ServicesView.vue` 中，找到 `<!-- 服务卡片网格 -->` 到 `</div>` 结束的部分（约第 76-106 行），替换为：

```vue
    <!-- 服务卡片网格 -->
    <div v-else class="service-grid">
      <div
        v-for="(svc, index) in filteredServices"
        :key="svc.id"
        class="svc-card"
        :class="'status-' + svc.status"
        :style="{ animationDelay: index * 80 + 'ms' }"
        @click="openDrawer(svc)"
      >
        <div class="status-bar" />
        <div class="svc-top">
          <div class="svc-icon">
            <el-icon :size="28"><component :is="svc.icon" /></el-icon>
            <span class="status-dot" :class="'dot-' + svc.status" />
          </div>
          <div class="svc-info">
            <div class="svc-name-row">
              <span class="svc-name">{{ svc.name }}</span>
              <el-tag :type="statusType(svc.status)" size="small" effect="dark">{{ statusLabel(svc.status) }}</el-tag>
            </div>
            <p class="svc-desc">{{ svc.description }}</p>
          </div>
        </div>
        <div class="svc-meta">
          <el-tag size="small" type="info">{{ svc.category }}</el-tag>
          <span class="svc-url">{{ svc.url }}</span>
        </div>
      </div>
    </div>
```

- [ ] **步骤 2：验证卡片显示**

运行：`npm run dev`
预期：卡片正常显示，点击卡片无反应（抽屉还未添加）

- [ ] **步骤 3：Commit**

```bash
git add src/views/ServicesView.vue
git commit -m "refactor(services): 更新卡片网格和卡片结构"
```

---

### 任务 3：添加右侧抽屉面板

**文件：**
- 修改：`src/views/ServicesView.vue` — 在 `</el-dialog>` 之后添加抽屉组件

- [ ] **步骤 1：添加右侧抽屉面板**

在 `src/views/ServicesView.vue` 中，找到最后一个 `</el-dialog>` 之后、`</div>` 结束之前（约第 229 行后），添加：

```vue
    <!-- 右侧详情抽屉 -->
    <Transition name="drawer-slide">
      <div v-if="drawerVisible" class="drawer-overlay" @click.self="drawerVisible = false">
        <div class="drawer-panel" v-if="selectedService">
          <div class="drawer-header">
            <h3>{{ selectedService.name }}</h3>
            <button class="drawer-close" @click="drawerVisible = false">✕</button>
          </div>
          <div class="drawer-content">
            <div class="drawer-icon" :class="'status-' + selectedService.status">
              <el-icon :size="40"><component :is="selectedService.icon" /></el-icon>
            </div>
            <el-tag :type="statusType(selectedService.status)" size="small" effect="dark">
              {{ statusLabel(selectedService.status) }}
            </el-tag>

            <div class="drawer-section">
              <div class="drawer-label">服务地址</div>
              <div class="drawer-url">
                <el-icon><Link /></el-icon>
                <span>{{ selectedService.url }}</span>
              </div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">描述</div>
              <div class="drawer-value">{{ selectedService.description || '暂无描述' }}</div>
            </div>

            <div class="drawer-section">
              <div class="drawer-label">备注</div>
              <div class="drawer-notes">{{ selectedService.notes || '暂无备注' }}</div>
            </div>
          </div>
          <div class="drawer-footer">
            <div class="drawer-actions-left">
              <el-button @click="openEditFromDrawer">
                <el-icon><Edit /></el-icon> 编辑
              </el-button>
              <el-popconfirm
                :title="`确定删除「${selectedService?.name}」吗？`"
                @confirm="deleteFromDrawer"
              >
                <template #reference>
                  <el-button type="danger">
                    <el-icon><Delete /></el-icon> 删除
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
            <el-button type="primary" @click="openService(selectedService.url)">
              <el-icon><Position /></el-icon> 访问服务
            </el-button>
          </div>
        </div>
      </div>
    </Transition>
```

- [ ] **步骤 2：添加抽屉相关的响应式数据和方法**

在 `src/views/ServicesView.vue` 的 `<script setup>` 部分，找到 `const detailVisible = ref(false)` 之后（约第 272 行后），添加：

```typescript
const drawerVisible = ref(false)

function openDrawer(svc: Service) {
  selectedService.value = svc
  drawerVisible.value = true
}

function openEditFromDrawer() {
  if (selectedService.value) {
    openEditDialog(selectedService.value)
  }
}

function deleteFromDrawer() {
  if (selectedService.value) {
    servicesStore.deleteService(selectedService.value.id)
    drawerVisible.value = false
    selectedService.value = null
  }
}
```

- [ ] **步骤 3：验证抽屉功能**

运行：`npm run dev`
点击任意卡片
预期：右侧滑出抽屉面板，显示服务详情

- [ ] **步骤 4：Commit**

```bash
git add src/views/ServicesView.vue
git commit -m "feat(services): 添加右侧抽屉面板显示服务详情"
```

---

### 任务 4：添加抽屉样式

**文件：**
- 修改：`src/views/ServicesView.vue:390+` — 在 `<style scoped>` 部分添加抽屉样式

- [ ] **步骤 1：添加抽屉样式**

在 `src/views/ServicesView.vue` 的 `<style scoped>` 部分，找到 `</style>` 之前（约第 818 行前），添加：

```css
/* ---- 右侧抽屉面板 ---- */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: 400px;
  height: 100%;
  background: var(--ops-bg-card);
  border-left: 1px solid var(--ops-border-card);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--ops-border-card);
}

.drawer-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ops-text-primary);
}

.drawer-close {
  background: none;
  border: none;
  color: var(--ops-text-tertiary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.drawer-close:hover {
  background: var(--ops-bg-card-hover);
  color: var(--ops-text-primary);
}

.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawer-icon.status-online { background: rgba(63, 185, 80, 0.15); color: var(--ops-status-online); }
.drawer-icon.status-offline { background: rgba(72, 79, 88, 0.3); color: var(--ops-text-tertiary); }
.drawer-icon.status-maintenance { background: rgba(210, 153, 34, 0.15); color: var(--ops-status-maintenance); }

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.drawer-label {
  font-size: 12px;
  color: var(--ops-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.drawer-url {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--ops-accent-blue);
  font-family: monospace;
  background: var(--ops-bg-page);
  padding: 10px 12px;
  border-radius: 8px;
}

.drawer-value {
  font-size: 14px;
  color: var(--ops-text-secondary);
  line-height: 1.6;
}

.drawer-notes {
  font-size: 14px;
  color: var(--ops-text-secondary);
  line-height: 1.6;
  background: var(--ops-bg-page);
  padding: 12px;
  border-radius: 8px;
  white-space: pre-wrap;
  font-family: monospace;
}

.drawer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid var(--ops-border-card);
}

.drawer-actions-left {
  display: flex;
  gap: 8px;
}

/* 抽屉过渡动画 */
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-slide-enter-active .drawer-panel,
.drawer-slide-leave-active .drawer-panel {
  transition: transform 0.3s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}

.drawer-slide-enter-from .drawer-panel,
.drawer-slide-leave-to .drawer-panel {
  transform: translateX(100%);
}
```

- [ ] **步骤 2：验证抽屉样式**

运行：`npm run dev`
点击任意卡片
预期：抽屉面板从右侧滑出，样式正确

- [ ] **步骤 3：Commit**

```bash
git add src/views/ServicesView.vue
git commit -m "style(services): 添加右侧抽屉面板样式和动画"
```

---

### 任务 5：更新卡片样式以匹配新设计

**文件：**
- 修改：`src/views/ServicesView.vue:456-490` — 更新卡片网格和卡片样式

- [ ] **步骤 1：更新卡片网格和卡片样式**

在 `src/views/ServicesView.vue` 的 `<style scoped>` 部分，找到 `.service-grid` 样式（约第 457-461 行），替换为：

```css
/* ---- 卡片网格 ---- */
.service-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  padding: 40px 0;
}

.svc-card {
  background: var(--ops-bg-card);
  border-radius: 12px;
  border: 1px solid var(--ops-border-card);
  padding: 20px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.svc-card:hover {
  border-color: var(--ops-border-card);
  box-shadow: var(--ops-shadow-card);
  background: var(--ops-bg-card-hover);
  transform: translateY(-2px);
}

.svc-card.status-online {
  background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-status-online));
}
.svc-card.status-offline {
  background: var(--ops-bg-card);
}
.svc-card.status-maintenance {
  background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-status-maintenance));
}
.svc-card.status-checking {
  background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-accent-blue));
}

/* 状态指示条 */
.status-bar {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  width: 4px;
}
.status-online .status-bar { background: var(--ops-status-online); }
.status-offline .status-bar { background: var(--ops-status-offline); }
.status-maintenance .status-bar { background: var(--ops-status-maintenance); }
.status-checking .status-bar { background: var(--ops-accent-blue); }
```

- [ ] **步骤 2：更新卡片顶部行样式**

在 `src/views/ServicesView.vue` 的 `<style scoped>` 部分，找到 `.svc-top` 样式（约第 522-526 行），替换为：

```css
/* 顶部行 */
.svc-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.svc-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
}
```

- [ ] **步骤 3：更新卡片信息行样式**

在 `src/views/ServicesView.vue` 的 `<style scoped>` 部分，找到 `.svc-info` 样式（约第 578-584 行），替换为：

```css
.svc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.svc-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.svc-info .svc-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ops-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **步骤 4：验证卡片样式**

运行：`npm run dev`
预期：卡片显示正常，左侧有状态色条，悬浮时上移

- [ ] **步骤 5：Commit**

```bash
git add src/views/ServicesView.vue
git commit -m "style(services): 更新卡片样式匹配新设计"
```

---

### 任务 6：最终验证

- [ ] **步骤 1：完整功能测试**

运行：`npm run dev`
测试以下场景：
1. 页面无侧边导航，全页面布局正常
2. 卡片为 2 列网格，左侧有状态色条
3. 点击卡片弹出右侧抽屉面板
4. 抽屉显示服务详情（图标、状态、地址、描述、备注）
5. 备注为纯文本格式
6. 底部有编辑/删除/访问按钮
7. 深色/浅色主题均正常显示
8. 搜索和筛选功能正常
9. 响应式布局正常（窄屏变单列）

- [ ] **步骤 2：最终 Commit**

```bash
git add src/views/ServicesView.vue
git commit -m "feat(services): 完成内网服务页面重设计 — 全页面布局和右侧抽屉面板"
```
