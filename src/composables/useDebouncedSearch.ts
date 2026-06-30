/**
 * 通用搜索防抖 composable
 * 替代各页面重复的 watch + setTimeout 防抖实现
 */
import { ref, watch, type Ref } from 'vue'

export function useDebouncedSearch(delay = 300) {
  const searchInput: Ref<string> = ref('')
  const search: Ref<string> = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(searchInput, (v) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { search.value = v }, delay)
  })

  /** 立即清空搜索（用于重置筛选时） */
  function clearSearch() {
    if (timer) clearTimeout(timer)
    searchInput.value = ''
    search.value = ''
  }

  return { searchInput, search, clearSearch }
}
