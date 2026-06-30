<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑机柜名称' : '新建机柜'"
    width="400px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <el-form label-position="top">
      <el-form-item label="机柜名称">
        <el-input v-model="form.name" placeholder="如 A区-01号" />
      </el-form-item>
      <el-form-item v-if="!isEdit" label="U 位数">
        <el-radio-group v-model="form.totalU">
          <el-radio-button :value="42">42U</el-radio-button>
          <el-radio-button :value="24">24U</el-radio-button>
          <el-radio-button :value="12">12U</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="!isEdit" label="楼层">
        <el-select v-model="form.floor" style="width:100%">
          <el-option v-for="f in floors" :key="f" :label="f" :value="f" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!form.name.trim()" @click="handleConfirm">{{ isEdit ? '保存' : '确定' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from 'vue'

interface RackData {
  id: string
  name: string
  totalU: number
  floor: string
}

const props = defineProps<{
  modelValue: boolean
  floors: string[]
  rack?: RackData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  create: [data: { name: string; totalU: number; floor: string }]
  save: [data: { id: string; name: string }]
}>()

const isEdit = computed(() => !!props.rack)

const form = reactive({
  name: '',
  totalU: 42,
  floor: '',
})

watch(() => props.modelValue, (v) => {
  if (v) {
    if (props.rack) {
      form.name = props.rack.name
    } else {
      form.name = ''
      form.totalU = 42
      form.floor = props.floors[0] || ''
    }
  }
})

function handleConfirm() {
  if (!form.name.trim()) return
  if (props.rack) {
    emit('save', { id: props.rack.id, name: form.name })
  } else {
    emit('create', { name: form.name, totalU: form.totalU, floor: form.floor })
  }
}
</script>
