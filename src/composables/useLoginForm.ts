import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const USERNAME_KEY = 'remembered_username'

function validate(username: string, password: string): string | null {
  if (!username) return '请输入用户名'
  if (!password) return '请输入密码'
  return null
}

export function useLoginForm() {
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()

  const form = reactive({
    username: '',
    password: '',
  })
  const formRef = ref()
  const rules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  }

  const loading = ref(false)
  const rememberUsername = ref(false)

  onMounted(() => {
    try {
      const saved = localStorage.getItem(USERNAME_KEY)
      if (saved) {
        form.username = saved
        rememberUsername.value = true
      }
    } catch { /* ignore */ }
  })

  function saveUsername() {
    if (rememberUsername.value) {
      localStorage.setItem(USERNAME_KEY, form.username)
    } else {
      localStorage.removeItem(USERNAME_KEY)
    }
  }

  async function handleLogin() {
    try {
      await formRef.value?.validate()
    } catch {
      return
    }

    const error = validate(form.username, form.password)
    if (error) {
      ElMessage.warning(error)
      return
    }

    saveUsername()

    loading.value = true
    try {
      await auth.login(form.username, form.password)
      ElMessage.success('登录成功')
      router.push((route.query.redirect as string) || '/')
    } catch (e: any) {
      ElMessage.error(e.message || '登录失败')
    } finally {
      loading.value = false
    }
  }

  return {
    form,
    formRef,
    rules,
    loading,
    rememberUsername,
    handleLogin,
  }
}