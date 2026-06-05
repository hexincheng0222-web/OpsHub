import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ComputerProcurement {
  id: number
  model: string           // 采购型号
  department: string     // 使用部门
  applicant: string      // 申请人
  macAddress: string     // MAC 地址
  deviceModel: string    // 设备型号
  ceNumber: string       // 使用人 CE 号
  actualUser: string     // 实际使用人
  approvalNumber: string // 钉钉审批流程编号
  receiveDate: string    // 收货日期
  assetNumber: string    // 关联固定资产编号
  deliveryDate: string   // 设备交付日期
  deliveryPerson: string // 设备交付人（运维组）
  pickupApproval: string // 领用审批流程编号
  ceProcessed: boolean    // 是否已走 CE 流程
  price: number          // 价格
}

export interface PhoneProcurement {
  id: number
  assetNumber: string    // 资产编号（按加入顺序递增）
  partNo: string         // Part No
  serialNo: string       // Serial No
  imei: string           // IMEI/MEID
  arrivalDate: string    // 到货时间
  pickupDate: string     // 领用时间
  brand: string          // 品牌
  model: string          // 型号
  assetLink: string      // 资产关联
  department: string     // 领用部门
  handler: string        // 经手人
  recipient: string      // 领用人
  dingtalkCreator: string // 钉钉流程创建人
  purchaseType: string   // 换/新购
  dingtalkFlow: string   // 钉钉流程
  originalOwner: string  // 原手机归属
  notes: string          // 备注
}

// ===== 电脑采购 Mock =====
export const mockComputers: ComputerProcurement[] = [
  { id: 1, model: 'MacBook Pro 16"', department: '研发部', applicant: '张三', macAddress: 'A1:B2:C3:D4:E5:F6', deviceModel: 'MacBook Pro M3 Max', ceNumber: 'CE20250001', actualUser: '张三', approvalNumber: 'DT202501001', receiveDate: '2025-01-15', assetNumber: 'IT-PC-2025-001', deliveryDate: '2025-01-16', deliveryPerson: '运维-王五', pickupApproval: 'DT202501002', ceProcessed: true, price: 18999 },
  { id: 2, model: 'Dell XPS 15', department: '设计部', applicant: '李四', macAddress: 'B2:C3:D4:E5:F6:A1', deviceModel: 'Dell XPS 15 9530', ceNumber: 'CE20250002', actualUser: '李四', approvalNumber: 'DT202502001', receiveDate: '2025-02-10', assetNumber: 'IT-PC-2025-002', deliveryDate: '2025-02-11', deliveryPerson: '运维-王五', pickupApproval: 'DT202502002', ceProcessed: true, price: 12999 },
  { id: 3, model: 'ThinkPad X1 Carbon', department: '市场部', applicant: '王五', macAddress: 'C3:D4:E5:F6:A1:B2', deviceModel: 'ThinkPad X1 Carbon Gen 11', ceNumber: 'CE20250003', actualUser: '王五', approvalNumber: 'DT202503001', receiveDate: '2025-03-05', assetNumber: 'IT-PC-2025-003', deliveryDate: '2025-03-06', deliveryPerson: '运维-赵六', pickupApproval: 'DT202503002', ceProcessed: false, price: 10999 },
  { id: 4, model: 'MacBook Air 15"', department: '财务部', applicant: '赵六', macAddress: 'D4:E5:F6:A1:B2:C3', deviceModel: 'MacBook Air M3', ceNumber: 'CE20250004', actualUser: '赵六', approvalNumber: 'DT202504001', receiveDate: '2025-04-20', assetNumber: 'IT-PC-2025-004', deliveryDate: '2025-04-21', deliveryPerson: '运维-王五', pickupApproval: 'DT202504002', ceProcessed: true, price: 8999 },
  { id: 5, model: 'HP EliteBook 840', department: '人事部', applicant: '钱七', macAddress: 'E5:F6:A1:B2:C3:D4', deviceModel: 'HP EliteBook 840 G10', ceNumber: '', actualUser: '钱七', approvalNumber: 'DT202505001', receiveDate: '2025-05-08', assetNumber: 'IT-PC-2025-005', deliveryDate: '2025-05-09', deliveryPerson: '运维-赵六', pickupApproval: '', ceProcessed: false, price: 7599 },
]

// ===== 手机采购 Mock =====
export const mockPhones: PhoneProcurement[] = [
  { id: 1, assetNumber: 'IT-PH-2025-001', partNo: 'A2849-001', serialNo: 'F2LW48XHQJ6D', imei: '356812090123456', arrivalDate: '2025-01-10', pickupDate: '2025-01-12', brand: 'Apple', model: 'iPhone 16 Pro Max 256G', assetLink: 'IT-PC-2025-001', department: '研发部', handler: '运维-王五', recipient: '张三', dingtalkCreator: '张三', purchaseType: '新购', dingtalkFlow: 'DT202501001', originalOwner: '—', notes: '研发新机' },
  { id: 2, assetNumber: 'IT-PH-2025-002', partNo: 'S24U-002', serialNo: 'R5YT72NPLK8H', imei: '356812090123457', arrivalDate: '2025-02-05', pickupDate: '2025-02-07', brand: 'Samsung', model: 'Galaxy S24 Ultra 512G', assetLink: 'IT-PC-2025-002', department: '设计部', handler: '运维-王五', recipient: '李四', dingtalkCreator: '李四', purchaseType: '新购', dingtalkFlow: 'DT202502001', originalOwner: '—', notes: '设计备用机' },
  { id: 3, assetNumber: 'IT-PH-2025-003', partNo: 'MI14-003', serialNo: 'T9ZU34WVMN2P', imei: '860123456789012', arrivalDate: '2025-03-15', pickupDate: '2025-03-16', brand: '小米', model: 'Xiaomi 14 Ultra', assetLink: 'IT-PC-2025-003', department: '市场部', handler: '运维-赵六', recipient: '王五', dingtalkCreator: '王五', purchaseType: '换', dingtalkFlow: 'DT202503001', originalOwner: '王五', notes: '旧机屏幕损坏换新' },
  { id: 4, assetNumber: 'IT-PH-2025-004', partNo: 'OP12-004', serialNo: 'K3LMW5QXRJ7T', imei: '860123456789013', arrivalDate: '2025-04-01', pickupDate: '2025-04-03', brand: 'OPPO', model: 'Find X7 Ultra', assetLink: 'IT-PC-2025-004', department: '财务部', handler: '运维-王五', recipient: '赵六', dingtalkCreator: '赵六', purchaseType: '新购', dingtalkFlow: 'DT202504001', originalOwner: '—', notes: '' },
  { id: 5, assetNumber: 'IT-PH-2025-005', partNo: 'HW60-005', serialNo: 'P8QNX2VYKM4R', imei: '860123456789014', arrivalDate: '2025-05-20', pickupDate: '2025-05-21', brand: '华为', model: 'Mate 60 Pro+', assetLink: 'IT-PC-2025-005', department: '人事部', handler: '运维-赵六', recipient: '钱七', dingtalkCreator: '钱七', purchaseType: '新购', dingtalkFlow: 'DT202505001', originalOwner: '—', notes: '商务机' },
]

export const useComputerProcurementStore = defineStore('computerProcurement', () => {
  const computers = ref<ComputerProcurement[]>([...mockComputers])
  const total = computed(() => computers.value.length)
  function addComputer(c: ComputerProcurement) { computers.value.push(c) }
  function updateComputer(id: number, data: Partial<ComputerProcurement>) {
    const idx = computers.value.findIndex(c => c.id === id)
    if (idx !== -1) computers.value[idx] = { ...computers.value[idx], ...data }
  }
  function deleteComputer(id: number) { computers.value = computers.value.filter(c => c.id !== id) }
  function nextId() { return computers.value.reduce((max, c) => Math.max(max, c.id), 0) + 1 }
  return { computers, total, addComputer, updateComputer, deleteComputer, nextId }
})

export const usePhoneProcurementStore = defineStore('phoneProcurement', () => {
  const phones = ref<PhoneProcurement[]>([...mockPhones])
  const total = computed(() => phones.value.length)
  function addPhone(p: PhoneProcurement) { phones.value.push(p) }
  function updatePhone(id: number, data: Partial<PhoneProcurement>) {
    const idx = phones.value.findIndex(p => p.id === id)
    if (idx !== -1) phones.value[idx] = { ...phones.value[idx], ...data }
  }
  function deletePhone(id: number) { phones.value = phones.value.filter(p => p.id !== id) }
  function nextId() { return phones.value.reduce((max, p) => Math.max(max, p.id), 0) + 1 }
  return { phones, total, addPhone, updatePhone, deletePhone, nextId }
})
