/**
 * 从 Excel 文件导入电脑采购和手机采购数据
 * 运行: node scripts/import-procurement.mjs
 */
import Database from 'better-sqlite3'
import XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const db = new Database(join(__dirname, '..', 'data', 'opshub.db'))

// ========== 电脑采购 ==========
console.log('=== 导入电脑采购数据 ===')
const wb1 = XLSX.readFile('C:/Users/何鑫城/Desktop/小h的页面文档/新电脑采购明细.xlsx')
const computerData = XLSX.utils.sheet_to_json(wb1.Sheets['Sheet1'], { header: 1 })

// 删除旧的测试数据
db.prepare('DELETE FROM computer_procurement').run()
console.log('已清除旧数据')

const insertComputer = db.prepare(`
  INSERT INTO computer_procurement
  (model, department, applicant, mac_address, device_model, ce_number, actual_user,
   approval_number, receive_date, asset_number, delivery_date, delivery_person,
   pickup_approval, ce_processed, price)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Excel 列映射:
// 0:采购型号 1:使用部门 2:申请人 3:照片 4:mac地址 5:型号 6:使用人CE号
// 7:实际使用人 8:申请审批流程编号 9:收货日期 10:关联固定资产编号
// 11:设备交付日期 12:设备交付人 13:领用审批流程编号 14:是否已走CE流程
// 15:价格 16:付款 17:渠道 18:预算部门 19:新成本中心 20:新使用人 21:加装高值易耗

function formatDate(v) {
  if (!v) return ''
  const s = String(v).trim()
  if (s === '——' || s === '-' || s === '/') return ''
  // 处理 Excel 序列号日期
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000)
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  // 处理 2019.4.19 格式
  const dotMatch = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/)
  if (dotMatch) return `${dotMatch[1]}-${dotMatch[2].padStart(2,'0')}-${dotMatch[3].padStart(2,'0')}`
  // 处理 2019/4/19 格式
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2,'0')}-${slashMatch[3].padStart(2,'0')}`
  return s
}

function parsePrice(v) {
  if (!v) return 0
  if (typeof v === 'number') return v
  const s = String(v)
  const m = s.match(/[\d,]+\.?\d*/)
  return m ? parseFloat(m[0].replace(/,/g, '')) : 0
}

function toStr(v) {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

let computerImported = 0
let computerErrors = 0
const batchComputer = db.transaction(() => {
  for (let i = 1; i < computerData.length; i++) {
    const row = computerData[i]
    if (!row || !row[0]) continue // 跳过空行
    try {
      insertComputer.run(
        toStr(row[0]),    // model 采购型号
        toStr(row[1]),    // department 使用部门
        toStr(row[2]),    // applicant 申请人
        toStr(row[4]),    // mac_address
        toStr(row[5]),    // device_model 型号
        toStr(row[6]),    // ce_number 使用人CE号
        toStr(row[7]),    // actual_user 实际使用人
        toStr(row[8]),    // approval_number 申请审批流程编号
        formatDate(row[9]),   // receive_date 收货日期
        toStr(row[10]),   // asset_number 关联固定资产编号
        formatDate(row[11]),  // delivery_date 设备交付日期
        toStr(row[12]),   // delivery_person 设备交付人
        toStr(row[13]),   // pickup_approval 领用审批流程编号
        toStr(row[14]) === '是' ? 1 : 0,  // ce_processed
        parsePrice(row[15]),  // price 价格
      )
      computerImported++
    } catch (e) {
      computerErrors++
      if (computerErrors <= 5) console.error(`第${i+1}行错误:`, e.message)
    }
  }
})
batchComputer()
console.log(`电脑采购: 成功 ${computerImported} 条, 错误 ${computerErrors} 条`)

// 同步字典: 部门
const compDepts = [...new Set(computerData.slice(1).map(r => toStr(r[1])).filter(Boolean))].sort()
const insertDept = db.prepare('INSERT OR IGNORE INTO procurement_departments (name, sort_order) VALUES (?, ?)')
const batchDept = db.transaction(() => {
  compDepts.forEach((d, i) => insertDept.run(d, i))
})
batchDept()
console.log(`同步部门字典: ${compDepts.length} 个`)

// 同步字典: 经手人（从交付人提取）
const compHandlers = [...new Set(computerData.slice(1).map(r => toStr(r[12])).filter(Boolean))].sort()
const insertHandler = db.prepare('INSERT OR IGNORE INTO procurement_handlers (name, sort_order) VALUES (?, ?)')
const batchHandler = db.transaction(() => {
  compHandlers.forEach((h, i) => insertHandler.run(h, i))
})
batchHandler()
console.log(`同步经手人字典: ${compHandlers.length} 个`)

// 同步字典: 采购型号
const compPurchaseModels = [...new Set(computerData.slice(1).map(r => toStr(r[0])).filter(Boolean))].sort()
const insertPurchaseModel = db.prepare('INSERT OR IGNORE INTO computer_purchase_models (name, sort_order) VALUES (?, ?)')
const batchPM = db.transaction(() => {
  compPurchaseModels.forEach((m, i) => insertPurchaseModel.run(m, i))
})
batchPM()
console.log(`同步采购型号字典: ${compPurchaseModels.length} 个`)

// 同步字典: 设备型号
const compDeviceModels = [...new Set(computerData.slice(1).map(r => toStr(r[5])).filter(Boolean))].sort()
const insertDeviceModel = db.prepare('INSERT OR IGNORE INTO computer_device_models (name, sort_order) VALUES (?, ?)')
const batchDM = db.transaction(() => {
  compDeviceModels.forEach((m, i) => insertDeviceModel.run(m, i))
})
batchDM()
console.log(`同步设备型号字典: ${compDeviceModels.length} 个`)


// ========== 工作手机 ==========
console.log('\n=== 导入工作手机数据 ===')
const wb2 = XLSX.readFile('C:/Users/何鑫城/Desktop/小h的页面文档/工作手机.xlsx')
const phoneData = XLSX.utils.sheet_to_json(wb2.Sheets['201812手机信息及领用人'], { header: 1 })

// 删除旧的测试数据
db.prepare('DELETE FROM phone_procurement').run()
console.log('已清除旧数据')

const insertPhone = db.prepare(`
  INSERT INTO phone_procurement
  (asset_number, part_no, serial_no, imei, arrival_date, pickup_date,
   brand, model, asset_link, department, handler, recipient,
   dingtalk_creator, purchase_type, dingtalk_flow, original_owner, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

// Excel 列映射:
// 0:资产编号 1:Part No 2:Serial No 3:IMEI/MEID 4:到货时间 5:领用时间
// 6:品牌 7:型号 8:资产关联 9:领用部门 10:经手人 11:领用人
// 12:钉钉流程创建人 13:换/新购 14:钉钉流程 15:原手机归属 16:备注 17:领用流程

let phoneImported = 0
let phoneErrors = 0
const batchPhone = db.transaction(() => {
  for (let i = 1; i < phoneData.length; i++) {
    const row = phoneData[i]
    if (!row || row[0] === null || row[0] === undefined) continue
    try {
      insertPhone.run(
        toStr(row[0]),    // asset_number 资产编号
        toStr(row[1]),    // part_no
        toStr(row[2]),    // serial_no
        toStr(row[3]),    // imei
        formatDate(row[4]),   // arrival_date 到货时间
        formatDate(row[5]),   // pickup_date 领用时间
        toStr(row[6]),    // brand 品牌
        toStr(row[7]),    // model 型号
        toStr(row[8]),    // asset_link 资产关联
        toStr(row[9]),    // department 领用部门
        toStr(row[10]),   // handler 经手人
        toStr(row[11]),   // recipient 领用人
        toStr(row[12]),   // dingtalk_creator 钉钉流程创建人
        toStr(row[13]) || '新购',  // purchase_type 换/新购
        toStr(row[14]),   // dingtalk_flow 钉钉流程
        toStr(row[15]),   // original_owner 原手机归属
        toStr(row[16]),   // notes 备注
      )
      phoneImported++
    } catch (e) {
      phoneErrors++
      if (phoneErrors <= 5) console.error(`第${i+1}行错误:`, e.message)
    }
  }
})
batchPhone()
console.log(`工作手机: 成功 ${phoneImported} 条, 错误 ${phoneErrors} 条`)

// 同步字典: 手机品牌
const phoneBrands = [...new Set(phoneData.slice(1).map(r => toStr(r[6])).filter(Boolean))].sort()
const insertPhoneBrand = db.prepare('INSERT OR IGNORE INTO phone_brands (name, sort_order) VALUES (?, ?)')
const batchPB = db.transaction(() => {
  phoneBrands.forEach((b, i) => insertPhoneBrand.run(b, i))
})
batchPB()
console.log(`同步手机品牌字典: ${phoneBrands.length} 个`)

// 同步字典: 手机型号
const phoneModels = [...new Set(phoneData.slice(1).map(r => `${toStr(r[6])}|${toStr(r[7])}`).filter(m => !m.startsWith('|')))].sort()
const insertPhoneModel = db.prepare('INSERT OR IGNORE INTO phone_models (name, brand_id, sort_order) VALUES (?, (SELECT id FROM phone_brands WHERE name = ?), ?)')
const batchPMod = db.transaction(() => {
  phoneModels.forEach((m, i) => {
    const [brand, model] = m.split('|')
    insertPhoneModel.run(model, brand, i)
  })
})
batchPMod()
console.log(`同步手机型号字典: ${phoneModels.length} 个`)

// 验证
const compCount = db.prepare('SELECT COUNT(*) as cnt FROM computer_procurement').get()
const phoneCount = db.prepare('SELECT COUNT(*) as cnt FROM phone_procurement').get()
const deptCount = db.prepare('SELECT COUNT(*) as cnt FROM procurement_departments').get()
const handlerCount = db.prepare('SELECT COUNT(*) as cnt FROM procurement_handlers').get()
console.log('\n=== 导入完成 ===')
console.log(`电脑采购: ${compCount.cnt} 条`)
console.log(`工作手机: ${phoneCount.cnt} 条`)
console.log(`部门字典: ${deptCount.cnt} 个`)
console.log(`经手人字典: ${handlerCount.cnt} 个`)

db.close()
