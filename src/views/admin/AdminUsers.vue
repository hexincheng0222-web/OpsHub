<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from '../../stores/auth'
import { fetchUsers, createUser, updateUser, deleteUser, resetPassword } from '../../api/users'
import type { UserInfo } from '../../api/auth'

const auth = useAuthStore()
const users = ref<UserInfo[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const roleFilter = ref('')
const dialogVisible = ref(false)
const resetDialogVisible = ref(false)
const isEdit = ref(false)
const form = ref({ username: '', password: '', display_name: '', role: 'user' as string })
const resetForm = ref({ userId: 0, userName: '', newPassword: '' })
const editingUser = ref<UserInfo | null>(null)

let searchTimer: ReturnType<typeof setTimeout> | null = null

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
    const data = await fetchUsers({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      role: roleFilter.value || undefined,
    })
    users.value = data.rows
    total.value = data.total
  } catch (e: any) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadUsers)

watch(keyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadUsers()
  }, 300)
})

watch(roleFilter, () => {
  page.value = 1
  loadUsers()
})

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
    ElMessage.error(e.message || '操作失败')
  }
}

async function handleToggleStatus(user: UserInfo) {
  try {
    await updateUser(user.id, { is_active: !user.is_active })
    ElMessage.success(user.is_active ? '已禁用' : '已启用')
    loadUsers()
  } catch (e: any) {
    ElMessage.error(e.message || '操作失败')
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
    if (e !== 'cancel' && e !== 'close') ElMessage.error(e.message || '删除失败')
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
    ElMessage.error(e.message || '重置失败')
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
        <span class="total-text">{{ total }} 个用户</span>
      </div>
      <el-button type="primary" size="small" @click="handleAdd">新增用户</el-button>
    </div>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        placeholder="搜索用户名或显示名..."
        clearable
        size="small"
        style="width: 260px"
        prefix-icon="Search"
      />
      <el-select v-model="roleFilter" placeholder="全部角色" clearable size="small" style="width: 130px">
        <el-option label="超级管理员" value="superadmin" />
        <el-option label="管理员" value="admin" />
        <el-option label="普通用户" value="user" />
      </el-select>
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
      <el-table-column label="操作" min-width="220" fixed="right">
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

    <div class="pagination" v-if="total > pageSize">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        @current-change="(p: number) => { page = p; loadUsers() }"
      />
    </div>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="420px" destroy-on-close>
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
            <el-option v-for="opt in availableRoles" :key="opt.value" :label="opt.label" :value="opt.value" />
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
        <el-input v-model="resetForm.newPassword" type="password" placeholder="请输入新密码" show-password />
      </el-form-item>
      <template #footer>
        <el-button @click="resetDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleResetSubmit">确认重置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page { width: 100%; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 16px; font-weight: 500; color: var(--ops-text-primary); }
.total-text { font-size: 12px; color: var(--ops-text-tertiary); }
.filter-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.cell-time { font-size: 12px; color: var(--ops-text-tertiary); font-variant-numeric: tabular-nums; }
.pagination { display: flex; justify-content: center; margin-top: 16px; }
</style>
