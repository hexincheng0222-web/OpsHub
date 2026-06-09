<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <router-link to="/" class="back-link">返回首页</router-link>
  </div>
</template>

<style scoped>
.not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: var(--ops-bg-page); }
.not-found h1 { font-size: 80px; font-weight: 800; color: var(--ops-accent-blue); margin: 0; }
.not-found p { font-size: 18px; color: var(--ops-text-secondary); margin: 8px 0 24px; }
.back-link { color: var(--ops-accent-blue); text-decoration: none; font-size: 14px; padding: 8px 20px; border: 1px solid var(--ops-accent-blue); border-radius: 8px; transition: all 0.2s; }
.back-link:hover { background: rgba(88,166,255,0.1); }
</style>
