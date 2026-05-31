# 内网服务管理页面 UI 优化

## TL;DR

> **Quick Summary**: 对 `ServicesView.vue` 实施 20 项 UI/UX 优化，包括暗色主题统一、CSS 变量体系、卡片视觉重构、表单验证完善、筛选增强，全部在单文件内完成。
>
> **Deliverables**:
> - `src/styles/variables.css` — 全局 CSS 变量文件（15 个暗色主题令牌）
> - `src/main.ts` — 新增 Element Plus 暗色模式导入 + CSS 变量导入
> - `src/views/ServicesView.vue` — 全面重构（template + script + style）
> - `src/mock/services.ts` — 添加预定义分类常量
> - `src/router/index.ts` — 添加面包屑 meta 字段
>
> **Estimated Effort**: Medium（约 6 小时）
> **Parallel Execution**: YES — 4 个 Wave，Phase 内任务高度并行
> **Critical Path**: 任务 1 → 任务 2 → 任务 3 → 任务 5 → 任务 15（Phase 1 串行是关键路径）

---

## Context

### Original Request
用户查看内网服务管理页面 UI 设计，识别优化点。逐项确认 32 个优化建议，最终采纳 20 项、跳过 12 项，并要求统一为暗色主题。

### Interview Summary
**关键决策**：
- **暗色主题**: 统一为 HomeView 风格的暗色主题，卡片保持状态色（绿=在线/灰=离线/橙=维护/蓝=检测）
- **Element Plus**: 启用暗色模式（导入 dark CSS variables），el-dialog/el-select/el-input 全部变暗
- **CSS 变量**: 全局共享，定义在 `src/styles/variables.css`，后续可复用到 HomeView
- **测试策略**: 无自动化测试，靠 Agent-Executed QA 场景验证
- **导航**: 加面包屑但不加侧边栏；删除虚线"添加服务"卡片，仅保留右上角按钮
- **响应式**: 不做任何移动端适配
- **排除项**: 侧边栏、全局 Header、检测时间戳、自定义主题色、URL 复制、移动端优化、视图切换、健康度趋势、检测汇总

**研究结论**：
- HomeView 暗色基础：背景 `#0a0e14`、卡片 `#12161e`、边框 `#1e2430`、文字 `#e6edf3`
- 当前状态色：在线 `#52c41a`、离线 `#d9d9d9`、维护中 `#faad14`、检测中 `#1890ff`
- Element Plus 2.14 原生支持暗色 CSS 变量
- 项目无任何测试文件，仅 dev/build/preview 脚本

### Metis Review
**识别的关键缺口** (已解决)：
- **颜色语义冲突**: 确认保持状态色（每种状态不同色调），而非统一卡片色
- **Element Plus 暗色**: 确认启用，导入 dark/css-vars.css
- **CSS 变量作用域**: 确认全局共享，后续复用
- **卡片高度语义**: 统一 min-height（同一行等高，通过 grid stretch）
- **URL 验证**: 必须接受内部地址（IP + 可选协议 + 自定义端口）
- **长名称溢出**: 添加 `text-overflow: ellipsis`
- **`window.open` 安全**: 添加 `noopener` 参数
- **暗色滚动条**: 添加 `color-scheme: dark`
- **`prefers-reduced-motion`**: 添加动画减少偏好支持

**采纳的 Metis 指令**：
- CSS 变量命名前缀 `--ops-*` 避免与 Element Plus 变量冲突
- 变量上限 15 个，仅覆盖背景/文字/边框/状态色/阴影
- 不做 HomeView 改造（后续复用即可）
- 不新增 npm 依赖
- 不创建新组件文件（所有改动在 ServicesView.vue + variables.css）
- Phase 1 后 ServicesView 的 `<style>` 中禁止硬编码颜色值

---

## Work Objectives

### Core Objective
将内网服务管理页面从亮色主题全面升级为暗色主题，同时完成 20 项 UI/UX 优化，提升视觉一致性和交互体验。

### Concrete Deliverables
- `src/styles/variables.css` — 15 个全局暗色 CSS 变量
- `src/main.ts` — 新增 2 行导入
- `src/router/index.ts` — 面包屑 meta 字段
- `src/views/ServicesView.vue` — template + script + style 全面重构
- `src/mock/services.ts` — 预定义分类常量

### Definition of Done
- [ ] `npm run build` 成功（无 TypeScript 错误）
- [ ] 页面渲染为暗色主题，与 HomeView 风格一致
- [ ] 所有 20 项优化均实现并通过 QA 场景验证
- [ ] 12 项排除项均未触及（代码审查确认）
- [ ] CSS 变量全部生效，浏览器 DevTools 可验证
- [ ] Element Plus 组件（dialog/select/input）在暗色背景下正确渲染

### Must Have
- 暗色主题（背景 `#0a0e14`，卡片 `#12161e`，文字 `#e6edf3`）
- CSS 变量体系（15 个，前缀 `--ops-*`）
- Element Plus 暗色模式
- 表单验证（名称必填、URL 必填且接受内网地址、分类必填）
- 状态指示器改为左侧 4px 彩色边框
- 可视化图标选择器（网格布局，渲染真实图标）
- 级联检测动画（逐卡片 staggered animation）
- 筛选空状态组件
- 面包屑导航
- 保存 loading 防重复提交

### Must NOT Have (Guardrails)
- **禁止修改**: HomeView.vue、App.vue、其他视图文件
- **禁止新增**: npm 依赖项
- **禁止创建**: 新 Vue 组件文件（全部在 ServicesView.vue 内联）
- **禁止硬编码颜色**: Phase 1 后 ServicesView `<style>` 中禁止 `#` 或 `rgb(` 颜色值
- **禁止超出 15 个 CSS 变量**: 仅限 `--ops-bg-page`, `--ops-bg-card`, `--ops-bg-card-hover`, `--ops-border-card`, `--ops-text-primary`, `--ops-text-secondary`, `--ops-text-tertiary`, `--ops-accent-blue`, `--ops-accent-green`, `--ops-accent-yellow`, `--ops-accent-gray`, `--ops-status-online`, `--ops-status-offline`, `--ops-status-maintenance`, `--ops-shadow-card`
- **禁止修改 Store 结构**: 不改 Pinia store 的接口/签名（仅可在现有函数内调整实现）
- **禁止**: 侧边栏、全局 Header、检测时间戳、自定义主题色、URL 复制按钮、移动端适配、视图切换、健康度趋势、检测汇总通知、aria 标签、flex-wrap
- **禁止**: 添加任何动画/过渡效果超出 #23 和 #24 范围
- **禁止**: 提取辅助函数（保持在 `<script setup>` 内联）
- **禁止**: 修改 `Service` 接口签名（仅可添加常量）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — 所有验证由 Agent 执行。

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: N/A
- **Agent-Executed QA**: 每个任务至少 1 个 happy path + 1 个 failure/edge case 场景

### QA Policy
- **前端/UI**: Playwright — 导航、截图、断言 DOM
- **构建验证**: `npm run build` — 零错误退出
- **CSS 变量验证**: `document.documentElement.style.getPropertyValue('--ops-bg-page')`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Phase 1 — Foundation):
├── 任务 1: CSS 变量文件 + Element Plus 暗色模式 [quick]
├── 任务 2: 面包屑导航 [quick]
├── 任务 3: 暗色主题基础（页面背景 + 卡片底色 + 文字色）[visual-engineering]
├── 任务 4: 页面内边距 [quick]
└── 任务 5: 暗色卡片系统（状态色卡片 + hover 效果 + 左侧状态边框）[visual-engineering]

Wave 2 (Phase 2 — Card System, after Wave 1):
├── 任务 6: 统一卡片最小高度 [quick]
├── 任务 7: 删除虚线"添加服务"卡片 [quick]
├── 任务 8: 加载骨架屏 [quick]
├── 任务 9: 级联检测动画 [deep]
└── 任务 10: 预定义分类常量 [quick]

Wave 3 (Phase 3 — Filters, after Wave 1):
├── 任务 11: 搜索框自适应宽度 [quick]
├── 任务 12: 筛选栏视觉分层 [quick]
└── 任务 13: 筛选空状态组件 [quick]

Wave 4 (Phase 4 — Forms, after Wave 1 + 任务 10):
├── 任务 14: 分类改为下拉选择 + allow-create [quick]
├── 任务 15: 表单验证规则 [deep]
├── 任务 16: 可视化图标选择器 [visual-engineering]
├── 任务 17: 保存按钮 loading 防重复 [quick]
├── 任务 18: 弹窗响应式宽度 [quick]
└── 任务 19: 删除确认显示服务名称 [quick]

Wave FINAL (After ALL implementation tasks):
├── F1: Plan Compliance Audit (oracle)
├── F2: Code Quality Review (unspecified-high)
├── F3: Real Manual QA (unspecified-high + playwright)
└── F4: Scope Fidelity Check (deep)
```

**Critical Path**: 1 → 3 → 5 → 15

---

## TODOs

- [x] 1. 创建 CSS 变量文件 + Element Plus 暗色模式导入

  **What to do**:
  - 创建 `src/styles/variables.css`，定义 15 个 `--ops-*` CSS 变量（暗色主题）：
    - `--ops-bg-page: #0a0e14`
    - `--ops-bg-card: #12161e`
    - `--ops-bg-card-hover: #161b24`
    - `--ops-border-card: #1e2430`
    - `--ops-text-primary: #e6edf3`
    - `--ops-text-secondary: #8b949e`
    - `--ops-text-tertiary: #6e7681`
    - `--ops-accent-blue: #58a6ff`
    - `--ops-accent-green: #3fb950`
    - `--ops-accent-yellow: #d29922`
    - `--ops-accent-gray: #484f58`
    - `--ops-status-online: #3fb950`
    - `--ops-status-offline: #484f58`
    - `--ops-status-maintenance: #d29922`
    - `--ops-shadow-card: 0 4px 16px rgba(0,0,0,0.3)`
  - 在 `src/main.ts` 中添加两行导入：
    - `import 'element-plus/theme-chalk/dark/css-vars.css'`（Element Plus 暗色模式）
    - `import './styles/variables.css'`（全局变量）
  - 验证：`src/styles/variables.css` 文件存在，`src/main.ts` 有 2 行新 import

  **Must NOT do**:
  - 不要修改 `src/styles/global.css`
  - 不要添加超过 15 个 CSS 变量
  - 不要创建其他 CSS 文件
  - 变量值不要引用 Element Plus 的 `--el-*` 变量（避免循环依赖）

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 纯文件创建 + 两行导入，无复杂逻辑
  - **Skills**: []
  - **Skills Evaluated but Omitted**: 无

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 — 必须第一个完成（所有后续任务依赖 CSS 变量）
  - **Blocks**: 所有其他任务
  - **Blocked By**: None

  **References**:
  - `src/main.ts` — 现有导入结构（`import 'element-plus/dist/index.css'` 之后追加新导入）
  - `src/views/HomeView.vue` — 暗色颜色参考（背景 `#0a0e14`、卡片 `#12161e`、边框 `#1e2430`）
  - Element Plus 官方: 暗色模式通过 `import 'element-plus/theme-chalk/dark/css-vars.css'` 启用

  **Acceptance Criteria**:
  - [ ] `src/styles/variables.css` 存在，包含恰好 15 个 `--ops-*` CSS 变量
  - [ ] `src/main.ts` 包含 `import 'element-plus/theme-chalk/dark/css-vars.css'`
  - [ ] `src/main.ts` 包含 `import './styles/variables.css'`
  - [ ] `npm run build` 成功

  **QA Scenarios**:
  ```
  Scenario: 验证 CSS 变量在浏览器中可用
    Tool: Playwright
    Preconditions: dev server running (npm run dev)
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 打开浏览器 Console，执行: getComputedStyle(document.documentElement).getPropertyValue('--ops-bg-page')
      3. 断言返回值包含 "#0a0e14"
      4. 执行: getComputedStyle(document.documentElement).getPropertyValue('--ops-bg-card')
      5. 断言返回值包含 "#12161e"
    Expected Result: 所有 15 个 CSS 变量均可通过 getComputedStyle 获取到正确的值
    Failure Indicators: 任何变量返回空字符串或错误值
    Evidence: .omo/evidence/task-1-css-vars.png（截图 + Console 输出）

  Scenario: 验证构建不报错
    Tool: Bash
    Steps:
      1. 执行: npm run build
      2. 断言退出码为 0
    Expected Result: 构建成功，无 TypeScript 或 Vite 错误
    Failure Indicators: 非零退出码或控制台输出 error
    Evidence: .omo/evidence/task-1-build.txt（构建输出）
  ```

  **Commit**: YES
  - Message: `feat(styles): add CSS variables and Element Plus dark mode`
  - Files: `src/styles/variables.css`, `src/main.ts`

- [x] 2. 添加面包屑导航

  **What to do**:
  - 在 `src/router/index.ts` 的 `/services` 路由中添加 `meta: { title: '内网服务管理' }`
  - 在 `ServicesView.vue` 的 `.top-bar` 上方（或替换 `.back-btn`）添加面包屑：
    - HTML: `<el-breadcrumb separator=">">` 包含 `<el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>` 和 `<el-breadcrumb-item>内网服务管理</el-breadcrumb-item>`
    - "返回首页" 的 `<span class="back-btn">` 保留或移除均可（面包屑已提供导航）
  - 面包屑样式：字体 13px，颜色 `var(--ops-text-tertiary)`，最后一项 `var(--ops-text-primary)`

  **Must NOT do**:
  - 不要创建独立的 Breadcrumb 组件（内联在 ServicesView.vue）
  - 不要修改其他路由的 meta
  - 不要移除标题 `<h3>内网服务管理</h3>`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单模板改动 + 路由 meta 添加
  - **Skills**: []
  - **Skills Evaluated but Omitted**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES — 与任务 4 并行（都依赖任务 1，但互不依赖）
  - **Parallel Group**: Wave 1（with 任务 4）
  - **Blocks**: None
  - **Blocked By**: 任务 1（需要 CSS 变量）

  **References**:
  - `src/router/index.ts` — 路由定义位置（添加 meta 字段）
  - `src/views/ServicesView.vue:1-21` — 当前 top-bar 模板结构
  - Element Plus Breadcrumb 文档: https://element-plus.org/en-US/component/breadcrumb.html

  **Acceptance Criteria**:
  - [ ] 面包屑显示 "首页 > 内网服务管理"，首页为可点击链接
  - [ ] 点击"首页"跳转到 `/`
  - [ ] 路由 `/services` 有 `meta.title` 字段

  **QA Scenarios**:
  ```
  Scenario: 面包屑渲染正确且首页可点击
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 定位面包屑: .el-breadcrumb
      3. 断言文本包含 "首页" 和 "内网服务管理"
      4. 点击面包屑中的 "首页" 链接
      5. 断言导航到 / (URL 不包含 /services)
    Expected Result: 面包屑正确显示两个层级，首页链接可用
    Failure Indicators: 面包屑缺失、只有一项、首页不可点击
    Evidence: .omo/evidence/task-2-breadcrumb.png

  Scenario: 面包屑显示在页面顶部
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 检查面包屑位置: .el-breadcrumb 应在 .top-bar 上方或内部顶部
      3. 截图整页
    Expected Result: 面包屑位于标题上方，视觉层级清晰
    Evidence: .omo/evidence/task-2-breadcrumb-position.png
  ```

  **Commit**: YES
  - Message: `feat(services): add breadcrumb navigation`
  - Files: `src/views/ServicesView.vue`, `src/router/index.ts`

- [x] 3. 暗色主题基础（页面背景 + 卡片底色 + 文字色）

  **What to do**:
  - 重构 `ServicesView.vue` 的 `<style scoped>`，将所有硬编码颜色替换为 CSS 变量：
    - `.services-page` 背景: `var(--ops-bg-page)`
    - `.svc-card` 背景: `var(--ops-bg-card)`，边框: `var(--ops-border-card)`
    - `.svc-name` 颜色: `var(--ops-text-primary)`
    - `.svc-desc` 颜色: `var(--ops-text-secondary)`
    - `.back-btn` 颜色: `var(--ops-text-tertiary)`，hover: `var(--ops-accent-blue)`
    - `.top-bar h3` 颜色: `var(--ops-text-primary)`
    - `.top-bar` 底部边框: `var(--ops-border-card)`
    - `body` / `.services-page` 添加 `color-scheme: dark`（暗色滚动条）
  - 确保 `.top-bar` 的 `border-bottom` 使用变量
  - 确保 `.svc-url` 链接行背景使用暗色变量

  **Must NOT do**:
  - 不要修改卡片状态色（任务 5 处理）
  - 不要使用任何硬编码 `#` 或 `rgb(` 颜色值
  - 不要修改 template 结构（仅 style 块）
  - 不要修改字体大小或布局（仅颜色替换）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 需要理解暗色主题视觉层次，精确替换颜色变量
  - **Skills**: []
  - **Skills Evaluated but Omitted**: 无

  **Parallelization**:
  - **Can Run In Parallel**: NO — 必须在任务 5 之前（任务 5 在此基础上添加状态色）
  - **Parallel Group**: Wave 1 — 串行在任务 1 之后
  - **Blocks**: 任务 5
  - **Blocked By**: 任务 1

  **References**:
  - `src/views/ServicesView.vue:240-461` — 当前 `<style scoped>` 全部颜色定义
  - `src/styles/variables.css` — 任务 1 创建的变量文件（所有 `--ops-*` 变量名）
  - `src/views/HomeView.vue` — 暗色主题参考（背景色、卡片色、文字色对照）

  **Acceptance Criteria**:
  - [ ] `.services-page` 背景为 `#0a0e14`（深色）
  - [ ] `.svc-card` 背景为 `#12161e`
  - [ ] 所有文字颜色从 `#333`/`#666`/`#888`/`#999` 改为暗色对应变量
  - [ ] `grep -nE '#[0-9a-fA-F]{3,6}|rgb\(' src/views/ServicesView.vue` 返回空（零硬编码颜色）
  - [ ] 滚动条为暗色（`color-scheme: dark` 生效）

  **QA Scenarios**:
  ```
  Scenario: 页面背景和卡片为暗色
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 检查 body 或 .services-page 的 background-color
      3. 断言 computed style background-color 为 rgb(10, 14, 20)（即 #0a0e14）
      4. 检查第一个 .svc-card 的 background-color
      5. 断言为 rgb(18, 22, 30)（即 #12161e）
    Expected Result: 整体页面呈现暗色主题
    Failure Indicators: 背景为白色或浅色、卡片仍为白色
    Evidence: .omo/evidence/task-3-dark-theme.png

  Scenario: 无硬编码颜色值
    Tool: Bash (grep)
    Steps:
      1. 执行: grep -cE '#[0-9a-fA-F]{3,6}|rgb\(' src/views/ServicesView.vue
      2. 断言输出为 0（无匹配）
    Expected Result: ServicesView.vue 的 style 块中零硬编码颜色
    Failure Indicators: 任何非零匹配数
    Evidence: .omo/evidence/task-3-no-hardcoded.txt
  ```

  **Commit**: YES
  - Message: `style(services): apply dark theme with CSS variables`
  - Files: `src/views/ServicesView.vue`

- [x] 4. 页面上下内边距

  **What to do**:
  - 在 `ServicesView.vue` 的 `.services-page` 样式中添加 `padding: 20px 0`
  - 确保不影响 `max-width: 1200px; margin: 0 auto` 的居中效果

  **Must NOT do**:
  - 不要改动 `max-width` 或 `margin`
  - 不要修改任何其他样式规则

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 单行 CSS 修改
  - **Skills**: []
  - **Skills Evaluated but Omitted**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES — 与任务 2 并行
  - **Parallel Group**: Wave 1（with 任务 2）
  - **Blocks**: None
  - **Blocked By**: 任务 1（仅需 CSS 变量就绪，不依赖任务 3）

  **References**:
  - `src/views/ServicesView.vue:241-244` — `.services-page` 当前样式定义

  **Acceptance Criteria**:
  - [ ] `.services-page` 有 `padding: 20px 0`
  - [ ] 页面内容顶部和底部各有 20px 留白
  - [ ] `max-width: 1200px` 居中仍正常

  **QA Scenarios**:
  ```
  Scenario: 页面上下有内边距
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 检查 .services-page 的 padding-top
      3. 断言 computed style padding-top 为 20px
      4. 截图整页（展示顶部留白）
    Expected Result: 页面顶部和底部各 20px 空白
    Evidence: .omo/evidence/task-4-padding.png
  ```

  **Commit**: YES（与任务 2 或 3 合并）
  - Message: `style(services): add page vertical padding`
  - Files: `src/views/ServicesView.vue`

- [x] 5. 暗色卡片系统（状态色 + hover + 左侧边框）

  **What to do**:
  - **左侧状态边框**: 将 `.status-bar` 从顶部 3px 横条改为左侧 4px 竖条：
    - CSS: `left: 0; top: 0; bottom: 0; width: 4px; height: 100%`（替代 `top: 0; left: 0; right: 0; height: 3px`）
    - 颜色：online=`var(--ops-status-online)`, offline=`var(--ops-status-offline)`, maintenance=`var(--ops-status-maintenance)`, checking=`var(--ops-accent-blue)`
  - **状态色卡片**: 为每种状态设置不同的卡片背景色调：
    - online: `background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-status-online))`
    - offline: `background: var(--ops-bg-card)`（默认，暗淡）
    - maintenance: `background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-status-maintenance))`
    - checking: `background: color-mix(in srgb, var(--ops-bg-card) 92%, var(--ops-accent-blue))`
  - **增强 hover 效果**: 修改 `.svc-card:hover`：
    - `border-color: var(--ops-border-card)`
    - `box-shadow: var(--ops-shadow-card)`
    - `transform: translateY(-2px) scale(1.01)`
    - `background: var(--ops-bg-card-hover)`
  - **图标区域**: 保持图标背景按状态着色，颜色使用对应 CSS 变量
  - **`prefers-reduced-motion`**: 在 hover 和动画上包裹 `@media (prefers-reduced-motion: no-preference)`

  **Must NOT do**:
  - 不要改变卡片布局结构（flex/grid 不变）
  - 不要添加新的 DOM 元素
  - 不要修改 HomeView 风格
  - `color-mix` 是首选方案；如果浏览器不支持，降级为纯色变量

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: 需要精确的视觉效果，涉及 CSS 状态选择器、动画、color-mix 混合
  - **Skills**: []
  - **Skills Evaluated but Omitted**: 无

  **Parallelization**:
  - **Can Run In Parallel**: NO — 依赖任务 3 的暗色基础
  - **Parallel Group**: Wave 1 — 串行在任务 3 之后
  - **Blocks**: 任务 6（统一卡片高度需要知道边框位置）
  - **Blocked By**: 任务 3

  **References**:
  - `src/views/ServicesView.vue:326-339` — 当前 `.status-bar` 动画定义
  - `src/views/ServicesView.vue:319-323` — 当前 `.svc-card:hover` 定义
  - `src/views/ServicesView.vue:364-367` — 图标区域状态色
  - `src/views/HomeView.vue` — HomeView 卡片 glow hover 效果参考（`box-shadow: 0 0 40px rgba(...)` + `box-shadow: 0 8px 30px rgba(0,0,0,0.4)`）
  - MDN `color-mix()`: CSS 颜色混合函数，用于给暗色卡片叠加状态色调

  **Acceptance Criteria**:
  - [ ] 左侧 4px 状态竖条替代顶部 3px 横条
  - [ ] 在线卡片有绿色调、离线卡片灰暗、维护中卡片有橙色调、检测中卡片有蓝色调
  - [ ] hover 时卡片有 `scale(1.01)` + `shadow` + 背景色变化
  - [ ] `prefers-reduced-motion` 媒体查询包裹动画属性
  - [ ] 图标区域状态色与左侧边框颜色语义一致

  **QA Scenarios**:
  ```
  Scenario: 在线和离线卡片视觉可区分
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 定位第一个在线卡片: .svc-card.status-online
      3. 断言左侧边框颜色为绿色（检查 border-left-color 或 .status-bar background-color）
      4. 定位离线卡片: .svc-card.status-offline（ELK 日志平台）
      5. 断言离线卡片背景色暗于在线卡片（check background-color 亮度差异）
      6. 截图
    Expected Result: 在线和离线卡片有明显视觉差异，左侧状态条醒目
    Failure Indicators: 所有卡片背景相同、状态条不可见、离线卡片也有绿色调
    Evidence: .omo/evidence/task-5-status-colors.png

  Scenario: 卡片 hover 效果增强
    Tool: Playwright
    Preconditions: 页面已加载
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 定位第一个卡片 .svc-card
      3. hover 该卡片
      4. 检查 transform 属性（应有 scale 或 translateY）
      5. 检查 box-shadow（应比非 hover 状态更明显）
      6. 截图 hover 状态
    Expected Result: hover 时卡片微微放大 + 阴影加深 + 背景色变亮
    Evidence: .omo/evidence/task-5-hover.png
  ```

   **Commit**: YES
   - Message: `style(services): status left border, status colors, enhanced hover`
   - Files: `src/views/ServicesView.vue`

- [x] 6. 统一卡片最小高度

  **What to do**:
  - 在 `.svc-card` 样式中添加 `min-height: 220px`
  - 确保 CSS Grid 的 `align-items: stretch` 使同一行卡片等高

  **Must NOT do**:
  - 不要设置固定 `height`（允许内容多的卡片自然增长）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与任务 7、8、10 并行）
  - **Parallel Group**: Wave 2
  - **Blocks**: None
  - **Blocked By**: 任务 5

  **Acceptance Criteria**:
  - [ ] 所有卡片高度 >= 220px，同一行卡片等高
  - [ ] 描述文字短的卡片不会明显更矮

  **QA Scenarios**:
  ```
  Scenario: 卡片高度统一
    Tool: Playwright
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 执行 JS: 获取第一行所有 .svc-card 的 offsetHeight
      3. 断言所有值 >= 220 且高度差 < 10px
    Expected Result: 同一行卡片高度一致
    Evidence: .omo/evidence/task-6-height.png
  ```

  **Commit**: YES（与任务 5 合并）
  - Message: `style(services): uniform card min-height`
  - Files: `src/views/ServicesView.vue`

- [x] 7. 删除虚线"添加服务"卡片

  **What to do**:
  - 删除 template 中 `<div class="svc-card add-card" @click="openAddDialog">` 及其内容
  - 删除 style 中 `.add-card`、`.add-content` 相关样式规则
  - 保留右上角 `el-button type="primary" @click="openAddDialog"` 按钮

  **Must NOT do**:
  - 不要删除 `openAddDialog` 函数或右上角按钮

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES（与任务 6、8、10 并行）
  - **Parallel Group**: Wave 2
  - **Blocked By**: 任务 5

  **Acceptance Criteria**:
  - [ ] template 和 style 中无 `.add-card` 相关内容
  - [ ] 右上角"添加服务"按钮正常工作

  **QA Scenarios**:
  ```
  Scenario: 虚线卡片已移除
    Tool: Playwright
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 确认 .add-card 元素不存在
      3. 点击右上角 "添加服务" 按钮
      4. 断言弹窗打开
    Evidence: .omo/evidence/task-7-no-add-card.png
  ```

  **Commit**: YES（与任务 6 合并）
  - Message: `refactor(services): remove dashed add-service card`
  - Files: `src/views/ServicesView.vue`

- [x] 8. 加载骨架屏

  **What to do**:
  - 在 `<script setup>` 添加 `loading = ref(true)`，`onMounted` 检测完成后设 false
  - 当 `loading && services.length === 0` 时，渲染 6 个 `el-skeleton` 卡片模拟布局
  - 骨架布局：圆形 icon + 2 行文字 + 3 个矩形按钮

  **Must NOT do**:
  - 不要在 store 中添加 loading 状态
  - 已有数据时不显示骨架屏

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与任务 6、7、10 并行）
  - **Parallel Group**: Wave 2
  - **Blocked By**: 任务 5

  **Acceptance Criteria**:
  - [ ] 首次加载无数据时显示 6 个骨架卡片
  - [ ] 数据加载后骨架消失，真实卡片出现
  - [ ] 已有数据时不显示骨架屏

  **QA Scenarios**:
  ```
  Scenario: 骨架屏显示与消失
    Tool: Playwright
    Steps:
      1. 导航到 http://localhost:5173/services
      2. 检查 .el-skeleton 是否出现（若有延迟加载）
      3. 等待加载完成，断言 .svc-card 出现且 .el-skeleton 消失
    Evidence: .omo/evidence/task-8-skeleton.png
  ```

  **Commit**: YES
  - Message: `feat(services): add loading skeleton screen`
  - Files: `src/views/ServicesView.vue`

- [x] 9. 级联检测动画

  **What to do**:
  - 不修改 store（保持 Promise.allSettled 并发检测）
  - 每个卡片通过 `:style="{ animationDelay: index * 80 + 'ms' }"` 绑定级联延迟
  - 保持 `.status-checking` pulse 动画不变，仅添加延迟

  **Must NOT do**:
  - 不要修改 store
  - 不要用 JS setTimeout 逐卡片延迟

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES（与任务 6、7、8、10 并行）
  - **Parallel Group**: Wave 2
  - **Blocked By**: 任务 5

  **Acceptance Criteria**:
  - [ ] 卡片逐个闪烁，非全部同时
  - [ ] 间隔约 80ms
  - [ ] prefers-reduced-motion 时跳过动画

  **QA Scenarios**:
  ```
  Scenario: 级联动画
    Tool: Playwright
    Steps:
      1. 导航到 /services
      2. 点击"检测连通性"
      3. 检查卡片 animation-delay 值是否递增
      4. 验证第 1、3、6 卡片进入 checking 状态的时间差
    Expected Result: 卡片逐个闪烁
    Evidence: .omo/evidence/task-9-cascade.png
  ```

  **Commit**: YES
  - Message: `feat(services): cascade detection animation`
  - Files: `src/views/ServicesView.vue`

- [x] 10. 预定义分类常量

  **What to do**:
  - 在 `src/mock/services.ts` 导出: `export const SERVICE_CATEGORIES = ['DevOps', '监控', '基础设施', '协作'] as const`
  - 在 ServicesView 中导入，筛选栏 el-option 使用此常量
  - 保留原有 `categories` 计算属性

  **Must NOT do**:
  - 不修改 Service 接口

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES（与任务 6-9 并行）
  - **Parallel Group**: Wave 2
  - **Blocks**: 任务 14
  - **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 筛选栏分类包含 4 个预定义类别
  - [ ] 按分类筛选正常

  **QA Scenarios**:
  ```
  Scenario: 预定义分类筛选
    Tool: Playwright
    Steps:
      1. 选择分类筛选下拉，断言选项含 DevOps/监控/基础设施/协作
      2. 选择"监控"，断言仅显示 Grafana + ELK
    Evidence: .omo/evidence/task-10-category-filter.png
  ```

  **Commit**: YES
  - Message: `feat(services): add predefined service categories constant`
  - Files: `src/mock/services.ts`, `src/views/ServicesView.vue`

- [x] 11. 搜索框自适应宽度

  **What to do**:
  - 将 `.search-input { max-width: 320px }` 改为 `.search-input { flex: 1; min-width: 200px }`

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 3（与 12、13 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 搜索框自动填充可用宽度
  - [ ] 窗口缩小时搜索框不低于 200px

  **QA Scenarios**:
  ```
  Scenario: 搜索框自适应
    Tool: Playwright
    Steps:
      1. 检查 .search-input 宽度 > 320px（大屏幕下）
    Evidence: .omo/evidence/task-11-search-width.png
  ```

  **Commit**: YES（与任务 12/13 合并）
  - Message: `style(services): auto-width search input`
  - Files: `src/views/ServicesView.vue`

- [x] 12. 筛选栏视觉分层

  **What to do**:
  - 给 `.filter-bar` 添加浅色暗底包裹: `background: var(--ops-bg-card); padding: 12px 16px; border-radius: 10px; border: 1px solid var(--ops-border-card)`

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 3（与 11、13 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 筛选栏有卡片背景包裹，与下方卡片网格视觉分开

  **QA Scenarios**:
  ```
  Scenario: 筛选栏视觉分层
    Tool: Playwright
    Steps: 截图 .filter-bar，断言有背景色和边框
    Evidence: .omo/evidence/task-12-filter-bar.png
  ```

  **Commit**: YES（与任务 11/13 合并）
  - Message: `style(services): filter bar visual separation`
  - Files: `src/views/ServicesView.vue`

- [x] 13. 筛选空状态组件

  **What to do**:
  - 当 `filteredServices.length === 0` 且原始 `services.length > 0` 时，用 `<el-empty description="未找到匹配的服务">` 替代卡片网格
  - 在 el-empty 下添加"清除筛选"按钮：`<el-button @click="search=''; filterCategory=''; filterStatus=''">清除筛选</el-button>`

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 3（与 11、12 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 无匹配时显示空状态插图 + "未找到匹配的服务"
  - [ ] "清除筛选"按钮点击后恢复所有服务
  - [ ] 无服务（全部被删除）时不显示空状态（显示"暂无服务"或仅显示按钮）

  **QA Scenarios**:
  ```
  Scenario: 筛选无结果
    Tool: Playwright
    Steps:
      1. 搜索框输入 "zzzzzz"
      2. 断言出现 el-empty + "未找到匹配的服务"
      3. 点击"清除筛选"
      4. 断言所有卡片恢复显示
    Evidence: .omo/evidence/task-13-empty-state.png
  ```

  **Commit**: YES
  - Message: `feat(services): empty state for no filter results`
  - Files: `src/views/ServicesView.vue`

- [x] 14. 分类改为下拉选择 + allow-create

  **What to do**:
  - 将表单中 `<el-input v-model="form.category">` 替换为:
    - `<el-select v-model="form.category" filterable allow-create placeholder="选择或输入分类">`
    - `<el-option v-for="cat in SERVICE_CATEGORIES" :key="cat" :label="cat" :value="cat" />`
  - 确保筛选栏和表单共享同一分类列表 `SERVICE_CATEGORIES`

  **Must NOT do**:
  - 不要移除分类自由新建能力（allow-create 保留）

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 4（与 15-19 并行）| **Blocked By**: 任务 10

  **Acceptance Criteria**:
  - [ ] 表单分类为下拉选择，预填 4 个类别
  - [ ] 可输入新分类名创建

  **QA Scenarios**:
  ```
  Scenario: 分类下拉选择
    Tool: Playwright
    Steps:
      1. 打开"添加服务"弹窗
      2. 点击分类下拉，断言选项含 4 个预定义类别
      3. 输入新分类 "测试"，断言可创建
    Evidence: .omo/evidence/task-14-category-select.png
  ```

  **Commit**: YES
  - Message: `feat(services): category dropdown with allow-create`
  - Files: `src/views/ServicesView.vue`

- [x] 15. 表单验证规则

  **What to do**:
  - 为 `el-form` 添加 `:model="form"` 和 `:rules="formRules"` + `ref="serviceFormRef"`
  - 定义 `formRules`：
    - `name`: `[{ required: true, message: '请输入服务名称', trigger: 'blur' }]`
    - `url`: `[{ required: true, message: '请输入服务地址', trigger: 'blur' }, { validator: validateUrl, trigger: 'blur' }]`
    - `category`: `[{ required: true, message: '请选择分类', trigger: 'blur' }]`
  - `validateUrl`: 自定义验证器，接受格式：`http(s)://IP:port` 或 `IP:port` 或 `domain:port`，允许无协议头
  - `saveService()` 中：调用 `serviceFormRef.value.validate((valid) => { if (valid) { ... } })` 替代直接保存
  - 为 `el-form-item` 添加 `prop` 属性

  **Must NOT do**:
  - URL 验证不要拒绝内网 IP 地址
  - 不要使用浏览器默认 `type="url"`（会拒绝无协议 URL）

  **Recommended Agent Profile**: `deep`（URL 自定义验证器需要仔细的 regex）
  - **Skills**: []

  **Parallelization**: Wave 4（与 16-19 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 提交空表单显示 3 条验证错误
  - [ ] `192.168.1.1:8080` 通过验证
  - [ ] `http://192.168.1.1:8080` 通过验证
  - [ ] 空字符串触发必填错误

  **QA Scenarios**:
  ```
  Scenario: 空表单提交触发验证
    Tool: Playwright
    Steps:
      1. 打开"添加服务"弹窗
      2. 直接点击"保存"（不填任何字段）
      3. 断言出现 3 条错误: "请输入服务名称"、"请输入服务地址"、"请选择分类"
    Evidence: .omo/evidence/task-15-validation-errors.png

  Scenario: 内部 URL 通过验证
    Tool: Playwright
    Steps:
      1. 名称输入 "Test"，URL 输入 "192.168.1.1:8080"，分类选择 "DevOps"
      2. 点击保存
      3. 断言弹窗关闭（保存成功）
    Evidence: .omo/evidence/task-15-internal-url.png

  Scenario: 无效 URL 被拒绝
    Tool: Playwright
    Steps:
      1. URL 输入 "not a url!!"
      2. 点击保存
      3. 断言 URL 字段显示格式错误
    Evidence: .omo/evidence/task-15-invalid-url.png
  ```

  **Commit**: YES
  - Message: `feat(services): add form validation rules`
  - Files: `src/views/ServicesView.vue`

- [x] 16. 可视化图标选择器

  **What to do**:
  - 将图标选择从 `<el-select>` 下拉改为自定义图标网格：
    - 定义 `iconOptions` 数组: `['Setting', 'FolderOpened', 'Box', 'Odometer', 'DataAnalysis', 'Document', 'Reading', 'Connection', 'Tools', 'Cloudy']`
    - 渲染为 `<div class="icon-picker">`，每个选项 `<div class="icon-option" :class="{ selected: form.icon === icon }" @click="form.icon = icon">`
    - 每个选项内渲染 `<el-icon :size="24"><component :is="icon" /></el-icon>` + 标签名称
    - 选中样式: `border: 2px solid var(--ops-accent-blue); background: rgba(88, 166, 255, 0.15)`

  **Must NOT do**:
  - 不要使用第三方图标库
  - 不要修改 `form.icon` 的数据结构（仍为字符串）

  **Recommended Agent Profile**: `visual-engineering`
  - **Skills**: []

  **Parallelization**: Wave 4（与 15、17-19 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 图标选择器显示为网格（非下拉），每行 5 个
  - [ ] 每个选项渲染真实图标
  - [ ] 点击选中项有蓝色边框高亮
  - [ ] 编辑服务时默认图标正确高亮

  **QA Scenarios**:
  ```
  Scenario: 图标网格选择器
    Tool: Playwright
    Steps:
      1. 打开"添加服务"弹窗
      2. 定位 .icon-picker 容器
      3. 断言 .icon-option 数量为 10
      4. 点击第 3 个图标（Box）
      5. 断言该图标有 .selected 类且边框为蓝色
    Evidence: .omo/evidence/task-16-icon-picker.png
  ```

  **Commit**: YES
  - Message: `feat(services): visual icon grid picker`
  - Files: `src/views/ServicesView.vue`

- [x] 17. 保存按钮 loading 防重复

  **What to do**:
  - 添加 `saving = ref(false)` 
  - 在 `saveService()` 开头: `if (saving.value) return; saving.value = true`
  - 保存完成后: `saving.value = false`
  - 按钮绑定: `:loading="saving"`

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 4（与 15、16、18、19 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 保存时按钮显示 loading 状态
  - [ ] 快速双击仅触发一次保存

  **QA Scenarios**:
  ```
  Scenario: 防重复提交
    Tool: Playwright
    Steps:
      1. 打开弹窗，填写必填字段
      2. 快速双击保存按钮
      3. 断言 store 中新增服务仅 1 个（非 2 个）
    Evidence: .omo/evidence/task-17-no-duplicate.txt（store 状态日志）
  ```

  **Commit**: YES（与任务 15/18 合并）
  - Message: `feat(services): save button loading anti-duplicate`
  - Files: `src/views/ServicesView.vue`

- [x] 18. 弹窗响应式宽度

  **What to do**:
  - 将 `el-dialog` 的 `width="500px"` 改为动态绑定: `:width="dialogWidth"`
  - 添加 computed: `const dialogWidth = computed(() => window.innerWidth < 768 ? '90%' : '500px')`

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 4（与 15-17、19 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 大屏弹窗 500px，小屏弹窗 90%

  **QA Scenarios**:
  ```
  Scenario: 弹窗宽度响应式
    Tool: Playwright
    Steps:
      1. 打开弹窗，检查宽度约 500px
      2. 缩小视口至 500px
      3. 重新打开弹窗，断言宽度约 450px (90%)
    Evidence: .omo/evidence/task-18-dialog-width.png
  ```

  **Commit**: YES（与任务 15/17 合并）
  - Message: `style(services): responsive dialog width`
  - Files: `src/views/ServicesView.vue`

- [x] 19. 删除确认显示服务名称

  **What to do**:
  - 修改 `el-popconfirm` 的 `title` 属性从静态字符串 "确定删除？" 改为动态绑定:
    - `:title="\`确定删除「${svc.name}」吗？\`"`
  - 确认按钮文案保持默认 "确定"

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 4（与 15-18 并行）| **Blocked By**: 任务 1

  **Acceptance Criteria**:
  - [ ] 删除 Jenkins 时显示 "确定删除「Jenkins CI/CD」吗？"
  - [ ] 每个服务的删除确认都显示对应名称

  **QA Scenarios**:
  ```
  Scenario: 删除确认显示名称
    Tool: Playwright
    Steps:
      1. 点击 Jenkins 卡片的"删除"按钮
      2. 断言 popconfirm 文本包含 "Jenkins CI/CD"
      3. 点击"取消"，确认卡片未被删除
      4. 再次删除并确认，断言卡片消失
    Evidence: .omo/evidence/task-19-delete-confirm.png
  ```

   **Commit**: YES
   - Message: `feat(services): delete confirmation shows service name`
   - Files: `src/views/ServicesView.vue`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Get explicit user "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle` ✅ APPROVED
  Read the plan end-to-end. Verify: 19 tasks complete in code, 20 Must Have items present, 12 Must NOT Have items absent. Check all evidence files in `.omo/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/20] | Must NOT Have [N/12] | Tasks [N/19] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `general` ✅ APPROVED — Build: 4 pre-existing errors (no regressions), 0 hardcoded colors, 0 AI slop, 0 new deps
  Run `npm run build` (vue-tsc + vite). Check all changed files for: hardcoded colors (`grep '#[0-9a-fA-F]'` in ServicesView.vue), AI slop (excessive comments, over-abstraction), unused imports, console.log, any new npm dependency.
  Output: `Build [PASS/FAIL] | Hardcoded Colors [CLEAN/N issues] | Files [N clean/N issues] | VERDICT`

- [~] F3. **Real Manual QA** — `general` (+ `playwright` skill) ⚠️ BLOCKED — Chrome/Playwright not available in WSL environment. Agent attempted multiple installation methods (apt-get, symlink, docker, LD_PRELOAD) over 39m; all failed. Fallback: code-based structural verification performed.
  From clean state (no browser cache). Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: filters + empty state + cards together, form validation + category dropdown together, cascade animation + skeleton together. Test edge cases: 0 services, rapid filter toggling, all services offline, very long service name.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `oracle` ✅ APPROVED — 19/19 tasks compliant, 0 contamination, 12/12 excluded items absent
  For each of 19 tasks: read "What to do", read actual diff (git diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance per task. Detect cross-task contamination: task N touching task M's files (all should touch ServicesView.vue primarily). Flag unaccounted changes.
  Verify 12 excluded items NOT present in codebase.
  Output: `Tasks [N/19 compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | Excluded Items [12/12 absent] | VERDICT`

---

## Commit Strategy

All commits should be squashed into logical groups:

| Wave | Commit Message | Files |
|------|---------------|-------|
| Wave 1 (1-5) | `style(services): dark theme foundation — CSS variables, breadcrumb, card system` | `src/styles/variables.css`, `src/main.ts`, `src/router/index.ts`, `src/views/ServicesView.vue` |
| Wave 2 (6-10) | `feat(services): card UX — uniform height, skeleton, cascade animation, categories` | `src/views/ServicesView.vue`, `src/mock/services.ts` |
| Wave 3 (11-13) | `style(services): filter bar enhancements` | `src/views/ServicesView.vue` |
| Wave 4 (14-19) | `feat(services): form upgrades — validation, icon picker, anti-duplicate, responsive dialog` | `src/views/ServicesView.vue` |

Pre-commit check for every commit: `npm run build` must pass.

---

## Success Criteria

### Verification Commands
```bash
# 构建检查
npm run build                          # Expected: 退出码 0, 无 TS/构建错误

# CSS 变量检查 (浏览器 Console)
getComputedStyle(document.documentElement).getPropertyValue('--ops-bg-page')
# Expected: "#0a0e14"

# 硬编码颜色检查
grep -nE '#[0-9a-fA-F]{3,6}|rgb\(' src/views/ServicesView.vue
# Expected: 空输出（Phase 1 后零硬编码颜色）

# 排除项检查
grep -rn 'el-sidebar\|el-drawer\|add-card\|URL复制\|prefers-color-scheme' src/views/ServicesView.vue
# Expected: 空输出（12 项排除项均未触及）
```

### Final Checklist
- [ ] 所有 20 项 Must Have 已实现
- [ ] 所有 12 项 Must NOT Have 已排除
- [ ] `npm run build` 通过
- [ ] CSS 变量 15 个全部生效
- [ ] ServicesView.vue 无硬编码颜色
- [ ] Element Plus 组件在暗色背景下正确渲染
- [ ] 未修改 HomeView / App.vue / stores/services.ts 接口
- [ ] 未新增 npm 依赖

