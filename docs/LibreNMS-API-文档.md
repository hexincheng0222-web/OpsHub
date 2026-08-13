# LibreNMS API 使用文档

> **版本**: LibreNMS v10.3.0.141
> **基础地址**: `http://10.3.0.141/api/v0`
> **认证方式**: HTTP Header `X-Auth-Token`

---

## 一、认证

所有 API 请求必须在 HTTP Header 中携带 API Token：

```bash
X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa
```

### 测试连通性

```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/system"
```

成功返回：
```json
{"status": "ok",...}
```

---

## 二、设备管理

### 2.1 获取设备列表

```
GET /devices
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices"
```

**响应**:
```json
{
  "status": "ok",
  "devices": [
    {
      "device_id": 1,
      "hostname": "10.252.0.1",
      "sysName": "huawei_router",
      "display": "10.252.0.1",
      "ip": "10.252.0.1",
      "community": "bravou@123",
      "snmpver": "v2c",
      "port": 161,
      "transport": "udp",
      "sysDescr": "Huawei AR2240C-S...",
      "sysObjectID": ".1.3.6.1.4.1.2011.2.224.211",
      "os": "vrp",
      "version": "5.170 (V200R009C00SPC500)...",
      "hardware": "AR2200",
      "type": "firewall",
      "status": true,
      "uptime": 35411264,
      "last_polled": "2026-08-02T06:35:18.000000Z",
      "last_ping": "2026-08-02T06:35:15.000000Z",
      "last_ping_timetaken": 0.246,
      "location": {
        "id": 1,
        "location": "Shenzhen China",
        "lat": null,
        "lng": null
      },
      "icon": "images/os/huawei.svg"
    },
    ...
  ],
  "count": 22
}
```

### 2.2 获取单个设备详情

```
GET /devices/{hostname}
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1"
```

### 2.3 添加设备

```
POST /devices
```

**Body**:
```json
{
  "hostname": "192.168.100.100",
  "community": "public",
  "snmpver": "v2c",
  "port": 161,
  "transport": "udp"
}
```

### 2.4 删除设备

```
DELETE /devices/{hostname}
```

### 2.5 重命名设备

```
GET /devices/{hostname}/rename/{new_hostname}
```

### 2.6 更新设备字段

```
PUT /devices/{hostname}
```

**Body**:
```json
{
  "field": "purpose",
  "data": "核心路由器"
}
```

### 2.7 触发设备发现

```
GET /devices/{hostname}/discover
```

---

## 三、端口管理

### 3.1 获取设备端口列表

```
GET /devices/{hostname}/ports
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/ports"
```

**响应**:
```json
{
  "status": "ok",
  "ports": [
    {"ifName": "GigabitEthernet0/0/0"},
    {"ifName": "GigabitEthernet0/0/1"},
    {"ifName": "Vlanif10"},
    ...
  ]
}
```

### 3.2 获取端口详细信息

```
GET /devices/{hostname}/ports/{ifname}
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/ports/GigabitEthernet0/0/0"
```

### 3.3 获取端口图表

```
GET /devices/{hostname}/ports/{ifname}/{type}
```

**type 可选值**: `bits`, `upkts`, `errors`, `etherlike`, `dot3`

### 3.4 获取所有端口

```
GET /ports
```

### 3.5 获取单个端口信息

```
GET /ports/{portid}
```

### 3.6 搜索端口

```
GET /ports/search/{field}/{search?}
```

### 3.7 MAC 地址搜索

```
GET /ports/mac/{search}
```

### 3.8 更新端口描述

```
PUT /ports/{portid}/description
```

**Body**: `{"description": "连接核心交换机"}`

### 3.9 获取端口 IP 信息

```
GET /ports/{portid}/ip
```

### 3.10 获取端口 FDB 表

```
GET /ports/{portid}/fdb
```

### 3.11 获取端口堆叠信息

```
GET /devices/{hostname}/port_stack
```

### 3.12 获取端口光模块信息

```
GET /ports/{portid}/transceiver
```

### 3.13 获取设备光模块列表

```
GET /devices/{hostname}/transceivers
```

---

## 四、健康传感器（CPU/内存/温度/存储等）

### 4.1 列出可用健康图表类型

```
GET /devices/{hostname}/health
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/health"
```

**响应**:
```json
{
  "status": "ok",
  "graphs": [
    {"desc": "Current",            "name": "device_current"},
    {"desc": "Dbm",                "name": "device_dbm"},
    {"desc": "Percent",            "name": "device_percent"},
    {"desc": "State",              "name": "device_state"},
    {"desc": "Temperature",        "name": "device_temperature"},
    {"desc": "Voltage",            "name": "device_voltage"},
    {"desc": "Processors",         "name": "device_processor"},
    {"desc": "Storage",            "name": "device_storage"},
    {"desc": "Memory Pools",       "name": "device_mempool"}
  ],
  "count": 9
}
```

### 4.2 列出某类传感器列表

```
GET /devices/{hostname}/health/{type}/{sensor_id?}
```

**type 可选值**: `device_processor`, `device_mempool`, `device_temperature`, `device_storage`, `device_current`, `device_voltage`, `device_dbm`, `device_percent`, `device_state`

**示例**:
```bash
# 获取处理器列表
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/health/device_processor"

# 获取内存列表
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/health/device_mempool"

# 获取温度传感器列表
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/health/device_temperature"
```

**响应示例（处理器）**:
```json
{
  "status": "ok",
  "graphs": [
    {
      "sensor_id": 1,
      "desc": "SRU Board 11 Processor"
    }
  ],
  "count": 1
}
```

**响应示例（温度）**:
```json
{
  "status": "ok",
  "graphs": [
    {"sensor_id": 12, "desc": "GigabitEthernet0/0/0"},
    {"sensor_id": 13, "desc": "SRU Board 11"}
  ],
  "count": 2
}
```

### 4.3 获取健康图表（SVG 图片）

```
GET /devices/{hostname}/graphs/health/{type}/{sensor_id?}
```

**注意**: 返回的是 **SVG 图片**，不是 JSON 数据！

**示例**:
```bash
# CPU 图表
curl -o cpu.svg -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/graphs/health/device_processor/1"

# 内存图表
curl -o mem.svg -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/graphs/health/device_mempool/1"

# 温度图表
curl -o temp.svg -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/graphs/health/device_temperature/13"
```

### 4.4 通用图表获取

```
GET /devices/{hostname}/{type}
```

**示例**:
```bash
curl -o cpu.svg -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/device_processor"
```

**type 可选值**: `device_processor`, `device_mempool`, `device_temperature`, `device_storage`, `device_uptime`, `device_ping_perf` 等

### 4.5 ⚠️ 获取历史原始数据（RRD 文件）

LibreNMS API **不提供 JSON 格式的历史时序数据**。历史数据存储在 RRD 文件中，需要通过 SSH 到服务器用 `rrdtool fetch` 命令读取。

**RRD 文件路径**: `/opt/librenms/rrd/<hostname>/`

**关联关系**:

| 数据类型 | RRD 文件名 | 数据字段 |
|---------|-----------|---------|
| CPU 处理器 | `processor-vrp-<id>.rrd` | `usage` |
| 内存 | `mempool-vrp-system-<id>.rrd` | `used`, `free` |
| 温度 | `sensor-temperature-vrp-<id>.rrd` | `sensor` |
| 存储 | `storage-vrp-<name>.rrd` | `used`, `free` |
| 电流 | `sensor-current-vrp-<id>.rrd` | `sensor` |
| 电压 | `sensor-voltage-vrp-<id>.rrd` | `sensor` |

**通过 SSH 获取历史数据**:

```bash
# CPU 历史（最近1天，每5分钟一个数据点）
ssh huawei@10.3.0.141 \
  "rrdtool fetch /opt/librenms/rrd/10.252.0.1/processor-vrp-2883593.rrd AVERAGE -r 300 -s -86400"

# 内存历史
ssh huawei@10.3.0.141 \
  "rrdtool fetch /opt/librenms/rrd/10.252.0.1/mempool-vrp-system-2883593.rrd AVERAGE -r 300 -s -86400"

# 温度历史
ssh huawei@10.3.0.141 \
  "rrdtool fetch /opt/librenms/rrd/10.252.0.1/sensor-temperature-vrp-2883593.rrd AVERAGE -r 300 -s -86400"
```

**参数说明**:
- `-r 300` — 分辨率 300 秒（5 分钟）
- `-s -86400` — 从当前时间往前推 86400 秒（1 天）
- `-s -604800` — 7 天
- `-s -2592000` — 30 天
- `AVERAGE` — 聚合方式（还有 `MIN`, `MAX`, `LAST`）

**RRD 数据保留周期**:

| 粒度 | 保留周期 | 说明 |
|:---:|:--------:|------|
| 5 分钟 | 7 天 | 原始轮询数据，每 5 分钟一个点 |
| 30 分钟 | 30 天 | 6 个点合并为 1 个平均值 |
| 2 小时 | ~400 天 | 长期归档 |

---

## 五、设备图表

### 5.1 获取设备可用图表列表

```
GET /devices/{hostname}/graphs
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/graphs"
```

**响应**:
```json
{
  "status": "ok",
  "graphs": [
    {"desc": "Poller Time",         "name": "device_poller_perf"},
    {"desc": "Ping Response",       "name": "device_icmp_perf"},
    {"desc": "Device Availability", "name": "device_availability"},
    {"desc": "System Uptime",       "name": "device_uptime"},
    {"desc": "Ping Response",       "name": "device_ping_perf"},
    {"desc": "IPv4 Packet Statistics",      "name": "device_ipsystemstats_ipv4"},
    {"desc": "IPv6 Packet Statistics",      "name": "device_ipsystemstats_ipv6"},
    {"desc": "ICMP Statistics",            "name": "device_netstat_icmp"},
    {"desc": "IP Statistics",              "name": "device_netstat_ip"},
    {"desc": "SNMP Statistics",            "name": "device_netstat_snmp"},
    {"desc": "TCP Statistics",             "name": "device_netstat_tcp"},
    {"desc": "UDP Statistics",             "name": "device_netstat_udp"}
  ],
  "count": 19
}
```

---

## 六、设备可用性/宕机

### 6.1 获取设备可用性

```
GET /devices/{hostname}/availability
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices/10.252.0.1/availability"
```

**响应**:
```json
{
  "status": "ok",
  "availability": [
    {"duration": 86400,   "availability_perc": "100.000000"},
    {"duration": 604800,  "availability_perc": "100.000000"},
    {"duration": 2592000, "availability_perc": "100.000000"},
    {"duration": 31536000,"availability_perc": "100.000000"}
  ]
}
```

**duration 说明**: 86400=1天, 604800=7天, 2592000=30天, 31536000=365天

### 6.2 获取设备宕机记录

```
GET /devices/{hostname}/outages
```

---

## 七、告警管理

### 7.1 获取告警列表

```
GET /alerts
```

**可选参数**: `state` (0=未处理, 1=已确认, 2=已解决), `severity`

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/alerts"
```

### 7.2 获取单个告警

```
GET /alerts/{id}
```

### 7.3 确认告警

```
GET /alerts/{id}
```

### 7.4 取消静默告警

```
GET /alerts/unmute/{id}
```

### 7.5 告警规则

```
GET  /rules                    # 列出所有规则
GET  /rules/{id}               # 获取单个规则
POST /rules                    # 添加规则
PUT  /rules                    # 编辑规则
DELETE /rules/{id}             # 删除规则
```

### 7.6 告警模板

```
GET  /alert_templates          # 列出所有模板
GET  /alert_templates/{id}     # 获取单个模板
POST /alert_templates          # 添加模板
PUT  /alert_templates          # 编辑模板
```

### 7.7 告警日志

```
GET /logs/alertlog/{hostname?}
```

---

## 八、设备组管理

### 8.1 获取设备组列表

```
GET /devicegroups
```

### 8.2 获取组内设备

```
GET /devicegroups/{name}
```

### 8.3 添加设备组

```
POST /devicegroups
```

**Body**:
```json
{
  "name": "核心交换机",
  "type": "dynamic",
  "rules": "{\"condition\":\"AND\",\"rules\":[{\"field\":\"type\",\"type\":\"string\",\"input\":\"select\",\"operator\":\"equal\",\"value\":\"network\"}]}"
}
```

### 8.4 更新设备组

```
PUT /devicegroups/{name}
```

### 8.5 删除设备组

```
DELETE /devicegroups/{name}
```

### 8.6 设备组添加/移除设备

```
POST /devicegroups/{name}/devices
```

**Body**: `{"device_id": 1}`

---

## 九、日志查询

### 9.1 事件日志

```
GET /logs/eventlog/{hostname?}
```

**可用参数**: `limit`, `start`, `from`, `to`

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/logs/eventlog/10.252.0.1?limit=3"
```

**响应**:
```json
{
  "status": "ok",
  "logs": [
    {
      "event_id": 1,
      "device_id": 1,
      "hostname": "10.252.0.1",
      "sysName": "huawei_router",
      "datetime": "2026-07-20 08:29:03",
      "message": "Device 10.252.0.1 has been created",
      "type": "system",
      "username": "admin",
      "severity": 3
    }
  ],
  "count": 3,
  "total": 117
}
```

### 9.2 Syslog 日志

```
GET /logs/syslog/{hostname?}
```

### 9.3 认证日志

```
GET /logs/authlog
```

---

## 十、网络资源

### 10.1 ARP 表

```
GET /resources/ip/arp/{query}/{cidr?}
```

### 10.2 FDB（MAC 地址表）

```
GET  /resources/fdb                                       # 列出所有 FDB
GET  /resources/fdb/{mac}                                 # 按 MAC 查询
GET  /resources/fdb/{mac}/detail                          # MAC 详情
GET  /devices/{hostname}/fdb                              # 设备 FDB
GET  /ports/{portid}/fdb                                  # 端口 FDB
```

### 10.3 IP 地址

```
GET  /resources/ip/addresses/{address_family?}            # 列出所有 IP
GET  /resources/ip/networks/{address_family?}             # 列出所有网络
GET  /resources/ip/networks/{id}/ip                       # 网络下的 IP
GET  /devices/{hostname}/ip                               # 设备 IP
```

### 10.4 VLAN

```
GET  /resources/vlans                                      # 所有 VLAN
GET  /devices/{hostname}/vlans                             # 设备 VLAN
```

### 10.5 链路

```
GET  /resources/links                                      # 所有链路
GET  /resources/links/{id}                                 # 单条链路
GET  /devices/{hostname}/links                             # 设备链路
```

### 10.6 NAC（网络准入控制）

```
GET  /resources/nac                                       # 所有 NAC
GET  /resources/nac/{mac}                                 # 按 MAC 查询
GET  /devices/{hostname}/nac                              # 设备 NAC
```

---

## 十一、路由

### 11.1 BGP

```
GET  /bgp                                                  # 所有 BGP
GET  /bgp/{id}                                             # 单个 BGP
PUT  /bgp/{id}                                             # 编辑 BGP 描述
GET  /routing/bgp/cbgp                                     # CBGP
```

### 11.2 OSPF

```
GET  /ospf                                                 # 所有 OSPF
GET  /ospf_ports                                           # OSPF 端口
GET  /ospfv3                                               # OSPFv3
GET  /ospfv3_ports                                         # OSPFv3 端口
```

### 11.3 VRF

```
GET  /routing/vrf                                          # 所有 VRF
GET  /routing/vrf/{id}                                     # 单个 VRF
```

### 11.4 IPSec

```
GET  /routing/ipsec/data/{hostname}                        # IPSec 数据
```

### 11.5 MPLS

```
GET  /routing/mpls/saps                                    # MPLS SAPs
GET  /routing/mpls/services                                # MPLS 服务
```

---

## 十二、设备维护

### 12.1 设备维护模式

```
GET   /devices/{hostname}/maintenance                      # 获取维护状态
POST  /devices/{hostname}/maintenance                      # 开启维护
```

**Body**:
```json
{
  "duration": 3600,
  "notes": "路由器升级"
}
```

### 12.2 设备组维护

```
POST /devicegroups/{name}/maintenance
```

### 12.3 位置维护

```
POST /locations/{location}/maintenance
```

---

## 十三、无线传感器

### 13.1 列出可用无线图表

```
GET /devices/{hostname}/wireless/{type?}/{sensor_id?}
```

### 13.2 获取无线传感器

```
GET /devices/{hostname}/wireless-sensors
```

### 13.3 获取无线图表

```
GET /devices/{hostname}/graphs/wireless/{type}/{sensor_id?}
```

---

## 十四、库存/配置

### 14.1 设备清单

```
GET /inventory/{hostname}              # 设备清单
GET /inventory/{hostname}/all          # 完整清单
```

### 14.2 Oxidized 配置备份

```
GET  /oxidized/{hostname?}              # 列出配置
GET  /oxidized/config/{device_name}     # 获取配置
GET  /oxidized/config/search/{string}   # 搜索配置
```

### 14.3 组件管理

```
GET    /devices/{hostname}/components                    # 获取组件
POST   /devices/{hostname}/components/{type}             # 添加组件
PUT    /devices/{hostname}/components                    # 编辑组件
DELETE /devices/{hostname}/components/{component}        # 删除组件
```

---

## 十五、服务监控

### 15.1 服务列表

```
GET  /services                                            # 所有服务
GET  /services/{hostname}                                 # 设备服务
POST /services/{hostname}                                 # 添加服务
PUT  /services/{id}                                       # 编辑服务
DELETE /services/{id}                                     # 删除服务
```

### 15.2 服务图表

```
GET /devices/{hostname}/services/{id}/graphs/{datasource}
```

---

## 十六、位置管理

### 16.1 位置列表

```
GET /resources/locations
```

### 16.2 获取位置

```
GET /location/{location_id_or_name}
```

### 16.3 添加位置

```
POST /locations
```

### 16.4 编辑位置

```
PUT /locations/{location_id_or_name}
```

### 16.5 删除位置

```
DELETE /locations/{location}
```

---

## 十七、账单管理

### 17.1 账单列表

```
GET /bills
```

### 17.2 获取账单

```
GET /bills/{bill_id}
```

### 17.3 创建账单

```
POST /bills
```

### 17.4 删除账单

```
DELETE /bills/{bill_id}
```

### 17.5 账单图表

```
GET /bills/{bill_id}/graphs/{graph_type}
```

### 17.6 账单图数据（JSON 格式）

```
GET /bills/{bill_id}/graphdata/{graph_type}
```

**注意**: 这是为数不多的能直接返回 JSON 格式时序数据的端点！

### 17.7 账单历史

```
GET  /bills/{bill_id}/history
GET  /bills/{bill_id}/history/{bill_hist_id}/graphs/{graph_type}
GET  /bills/{bill_id}/history/{bill_hist_id}/graphdata/{graph_type}
```

---

## 十八、端口组

```
GET    /port_groups                                       # 列表
POST   /port_groups                                       # 创建
GET    /port_groups/{name}                                # 获取组内端口
POST   /port_groups/{port_group_id}/assign                # 分配端口
POST   /port_groups/{port_group_id}/remove                # 移除端口
```

---

## 十九、轮询器

```
GET /pollers                                              # 轮询器列表
GET /pollers/log                                          # 轮询日志
GET /poller_group/{poller_group_id_or_name?}              # 轮询器组
```

---

## 二十、系统信息

### 20.1 服务器信息

```
GET /system
```

**示例**:
```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/system"
```

### 20.2 Ping 测试

```
GET /ping
```

---

## 二十一、杂项

### 21.1 添加事件日志

```
POST /devices/{hostname}/eventlog
```

**Body**:
```json
{
  "message": "设备重启",
  "type": "system",
  "severity": 4,
  "reference": "ticket-123"
}
```

### 21.2 Syslog 接收

```
POST /syslogsink
```

### 21.3 传感器列表

```
GET /resources/sensors
```

### 21.4 端口安全

```
GET /port_security                              # 所有端口安全
GET /port_security/device/{hostname}            # 设备端口安全
GET /port_security/port/{portid}                # 端口安全详情
```

---

## 二十二、实际使用示例

### 22.1 获取所有设备状态

```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); [print(f\"{x['device_id']:3d} {x['hostname']:20s} {'UP' if x['status'] else 'DOWN':5s} {x['os']:10s} {x.get('hardware',''):20s} {x.get('version','')[:30]}') for x in d['devices']]"
```

### 22.2 获取所有告警

```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/alerts"
```

### 22.3 获取 CPU/内存/温度传感器 ID

```bash
for type in device_processor device_mempool device_temperature device_storage; do
  echo "=== $type ==="
  curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
    "http://10.3.0.141/api/v0/devices/10.252.0.1/health/$type"
done
```

### 22.4 导出所有设备数据到 CSV

```bash
curl -s -H "X-Auth-Token: 4570a0980ed18e3e33ee57978fcbb2aa" \
  "http://10.3.0.141/api/v0/devices" | \
  python3 -c "
import sys, json
d = json.load(sys.stdin)
print('device_id,hostname,sysName,os,hardware,version,status,uptime,type,location,last_polled')
for x in d['devices']:
    loc = x.get('location', {})
    if isinstance(loc, dict):
        loc = loc.get('location', '')
    print(f\"{x['device_id']},{x['hostname']},{x.get('sysName','')},{x['os']},{x.get('hardware','')},{x.get('version','')[:50]},{x['status']},{x['uptime']},{x.get('type','')},{loc},{x.get('last_polled','')}\")
"
```

---

## 附录：HTTP 状态码

| 状态码 | 含义 |
|:-----:|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求错误 |
| 401 | 认证失败（Token 无效） |
| 404 | 资源不存在 |
| 422 | 请求参数错误 |
| 500 | 服务器内部错误 |

---

> **文档生成日期**: 2026-08-02
> **LibreNMS 版本**: 10.3.0.141
> **API 基础地址**: http://10.3.0.141/api/v0