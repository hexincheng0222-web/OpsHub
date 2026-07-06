// 简易入参校验：检查必填字符串字段，返回中文错误
export function validateRequired(body: any, fields: { name: string; label: string; maxLength?: number }[]): string | null {
  for (const f of fields) {
    const val = body[f.name]
    if (val === undefined || val === null || val === '') {
      return `请填写${f.label}`
    }
    if (f.maxLength && typeof val === 'string' && val.length > f.maxLength) {
      return `${f.label}不能超过 ${f.maxLength} 个字符`
    }
  }
  return null
}
