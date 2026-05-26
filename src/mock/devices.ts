export interface Device {
  id: number; name: string; type: string; brand: string; dept: string; status: string; purchaseDate: string
}
export const mockDevices: Device[] = [
  { id: 1, name: '线上服务器-01', type: '服务器', brand: 'Dell R740', dept: '运维部', status: '正常', purchaseDate: '2023-03-15' },
  { id: 2, name: '线上服务器-02', type: '服务器', brand: 'Dell R740', dept: '运维部', status: '正常', purchaseDate: '2023-03-15' },
  { id: 3, name: '数据库服务器-主', type: '服务器', brand: 'HP DL380 Gen10', dept: '运维部', status: '正常', purchaseDate: '2022-08-20' },
  { id: 4, name: '开发机-张工', type: '台式机', brand: '联想 ThinkStation P360', dept: '技术部', status: '正常', purchaseDate: '2024-01-10' },
  { id: 5, name: '笔记本-李工', type: '笔记本', brand: 'MacBook Pro 16"', dept: '技术部', status: '正常', purchaseDate: '2023-11-05' },
  { id: 6, name: '核心交换机', type: '网络设备', brand: 'Huawei S6730', dept: '运维部', status: '正常', purchaseDate: '2022-06-01' },
  { id: 7, name: 'NAS 存储', type: '存储设备', brand: 'Synology DS1821+', dept: '运维部', status: '正常', purchaseDate: '2023-09-12' },
  { id: 8, name: '测试服务器', type: '服务器', brand: 'Dell R640', dept: '技术部', status: '维修中', purchaseDate: '2021-05-18' }
]
