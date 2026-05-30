# 首页卡片 UI 优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 优化运维中心首页的 4 张功能卡片，添加毛玻璃效果、悬浮动画和浅色主题适配

**架构：** 单文件修改，仅涉及 `src/views/HomeView.vue` 的 `<style scoped>` 部分

**技术栈：** Vue 3 + CSS3（backdrop-filter、transform、box-shadow）

---

## 文件结构

- **修改：** `src/views/HomeView.vue` — 添加浅色主题卡片样式

---

### 任务 1：添加卡片浅色主题基础样式

**文件：**
- 修改：`src/views/HomeView.vue:118` — `.big-card` 样式后添加浅色主题规则

- [ ] **步骤 1：添加浅色主题卡片背景和边框**

在 `src/views/HomeView.vue` 的 `<style scoped>` 部分，找到 `.big-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,.10)}` 这一行（约第 121 行），在其后添加：

```css
.light-theme .big-card{background:rgba(255,255,255,.80);border:1px solid rgba(0,0,0,.08)}
.light-theme .big-card:hover{border-color:rgba(0,0,0,.15);box-shadow:0 0 40px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.08)}
```

- [ ] **步骤 2：验证深色主题不受影响**

运行：`npm run dev`
打开：`http://localhost:5175/`
预期：深色主题下卡片保持毛玻璃效果，悬浮时上移 + 光晕扩散

- [ ] **步骤 3：验证浅色主题卡片效果**

在页面右下角点击主题切换按钮，切换到浅色主题
预期：卡片背景变为白色半透明，边框为浅灰色，悬浮时有柔和阴影

- [ ] **步骤 4：Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(home): 添加首页卡片浅色主题适配"
```

---

### 任务 2：添加卡片标题和描述的浅色主题适配

**文件：**
- 修改：`src/views/HomeView.vue:147-148` — `.card-body` 样式后添加浅色主题规则

- [ ] **步骤 1：添加卡片标题和描述的浅色主题样式**

在 `src/views/HomeView.vue` 的 `<style scoped>` 部分，找到 `.card-body p{font-size:13px;color:#8b949e;margin:0;line-height:1.55;letter-spacing:.2px}` 这一行（约第 148 行），在其后添加：

```css
.light-theme .card-body h3{color:#1f2328}
.light-theme .card-body p{color:#656d76}
```

- [ ] **步骤 2：验证浅色主题卡片文字可读性**

运行：`npm run dev`
切换到浅色主题
预期：卡片标题为深色，描述文字为中灰色，清晰可读

- [ ] **步骤 3：Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(home): 添加卡片标题和描述浅色主题适配"
```

---

### 任务 3：添加卡片统计数字的浅色主题适配

**文件：**
- 修改：`src/views/HomeView.vue:152-155` — `.stat-num` 样式后添加浅色主题规则

- [ ] **步骤 1：添加统计数字的浅色主题样式**

在 `src/views/HomeView.vue` 的 `<style scoped>` 部分，找到 `.card-orange .stat-num{color:#e3b341}` 这一行（约第 155 行），在其后添加：

```css
.light-theme .card-blue .stat-num{color:#0969da}
.light-theme .card-green .stat-num{color:#1a7f37}
.light-theme .card-purple .stat-num{color:#8250df}
.light-theme .card-orange .stat-num{color:#9a6700}
.light-theme .card-blue .card-icon-wrap{background:linear-gradient(135deg,rgba(9,105,218,.12),rgba(9,105,218,.04));color:#0969da;box-shadow:0 0 20px rgba(9,105,218,.08)}
.light-theme .card-green .card-icon-wrap{background:linear-gradient(135deg,rgba(26,127,55,.12),rgba(26,127,55,.04));color:#1a7f37;box-shadow:0 0 20px rgba(26,127,55,.08)}
.light-theme .card-purple .card-icon-wrap{background:linear-gradient(135deg,rgba(130,80,223,.12),rgba(130,80,223,.04));color:#8250df;box-shadow:0 0 20px rgba(130,80,223,.08)}
.light-theme .card-orange .card-icon-wrap{background:linear-gradient(135deg,rgba(154,103,0,.12),rgba(154,103,0,.04));color:#9a6700;box-shadow:0 0 20px rgba(154,103,0,.08)}
```

- [ ] **步骤 2：验证浅色主题卡片颜色一致性**

运行：`npm run dev`
切换到浅色主题
预期：每张卡片的数字、图标颜色与卡片主题色一致（蓝、绿、紫、橙）

- [ ] **步骤 3：Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(home): 添加卡片统计数字和图标浅色主题适配"
```

---

### 任务 4：添加卡片分割线的浅色主题适配

**文件：**
- 修改：`src/views/HomeView.vue:149` — `.card-stat` 样式后添加浅色主题规则

- [ ] **步骤 1：添加分割线的浅色主题样式**

在 `src/views/HomeView.vue` 的 `<style scoped>` 部分，找到 `.card-stat{position:relative;z-index:1;display:flex;align-items:baseline;gap:8px;padding-top:14px;border-top:1px solid rgba(255,255,255,.05)}` 这一行（约第 149 行），在其后添加：

```css
.light-theme .card-stat{border-top:1px solid rgba(0,0,0,.06)}
.light-theme .stat-label{color:#656d76}
.light-theme .stat-sub{color:#8b949e}
```

- [ ] **步骤 2：验证浅色主题分割线效果**

运行：`npm run dev`
切换到浅色主题
预期：卡片内的分割线为浅灰色，统计标签和副标签文字清晰可读

- [ ] **步骤 3：Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(home): 添加卡片分割线和标签浅色主题适配"
```

---

### 任务 5：最终验证和清理

- [ ] **步骤 1：完整功能测试**

运行：`npm run dev`
测试以下场景：
1. 深色主题下所有 4 张卡片显示正常
2. 深色主题下悬浮效果正常（上移 + 光晕）
3. 切换到浅色主题
4. 浅色主题下所有 4 张卡片显示正常
5. 浅色主题下悬浮效果正常（柔和阴影）
6. 切换回深色主题，验证无样式残留

- [ ] **步骤 2：响应式测试**

调整浏览器窗口宽度，验证：
1. 窄屏下卡片自动变为单列布局
2. 卡片内容不溢出

- [ ] **步骤 3：最终 Commit**

```bash
git add src/views/HomeView.vue
git commit -m "feat(home): 完成首页卡片 UI 优化 — 毛玻璃效果和双主题适配"
```
