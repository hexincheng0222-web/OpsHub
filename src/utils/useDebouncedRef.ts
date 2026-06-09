import { ref, watch, onUnmounted, type Ref } from 'vue'

/**
 * 带防抖的 ref，输入值变化后延迟 delay 毫秒才同步到输出值
 * @param initialValue 初始值
 * @param delay 防抖延迟（毫秒），默认 300
 * @returns [inputRef, outputRef] — inputRef 绑定到输入框，outputRef 用于筛选逻辑
 */
export function useDebouncedRef<T>(initialValue: T, delay = 300): [Ref<T>, Ref<T>] {
  const inputRef = ref<T>(initialValue) as Ref<T>
  const outputRef = ref<T>(initialValue) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | null = null

  watch(inputRef, (v) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { outputRef.value = v }, delay)
  })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
  })

  return [inputRef, outputRef]
}
