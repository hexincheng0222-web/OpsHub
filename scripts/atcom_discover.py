#!/usr/bin/env python3
"""
ATCOM 话机设备发现脚本（基于 IPPBX200 PBX）
根据《ATCOM 话机统一管控平台开发文档》编写

流程：
  1. POST /cgi-bin/luci 登录 IPPBX200，获取 sysauth cookie + stok
  2. GET  /admin/extension/sip/get 获取所有分机配置
  3. GET  /admin/status/sipext/get 获取分机 ID 列表
  4. GET  /admin/status/sipext/update?ids=xxx 刷新获取实时 IP

用法：
  python scripts/atcom_discover.py
  python scripts/atcom_discover.py 192.168.35.250 admin admin
"""

import sys
import json
import re
import os
import http.client
import urllib.parse
from typing import Optional

# ── 配置 ──────────────────────────────────────────────────────
# 优先从环境变量读取，其次从数据库读取，最后用默认值

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'opshub.db')

def read_config_from_db() -> dict:
    """从 SQLite 数据库读取 ATCOM 配置"""
    try:
        import sqlite3
        if not os.path.exists(DB_PATH):
            return {}
        conn = sqlite3.connect(DB_PATH)
        rows = conn.execute("SELECT key, value FROM system_config WHERE key LIKE 'atcom_%'").fetchall()
        conn.close()
        return {row[0]: row[1] for row in rows}
    except Exception:
        return {}

db_config = read_config_from_db()

PBX_IP   = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('ATCOM_PBX_IP',   db_config.get('atcom_pbx_ip',   '192.168.35.250'))
PBX_USER = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('ATCOM_PBX_USER', db_config.get('atcom_pbx_user', 'admin'))
PBX_PASS = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('ATCOM_PBX_PASS', db_config.get('atcom_pbx_pass', 'admin'))

# ── 工具函数 ─────────────────────────────────────────────────
def pbx_request(method: str, path: str, body: str = None,
                headers: dict = None, timeout: int = 10) -> tuple:
    """向 IPPBX200 发送 HTTP 请求，返回 (status, headers, body)"""
    conn = http.client.HTTPConnection(PBX_IP, 80, timeout=timeout)
    req_headers = {"User-Agent": "ATCOM-Discovery/1.0"}
    if headers:
        req_headers.update(headers)
    try:
        conn.request(method, path, body=body, headers=req_headers)
        resp = conn.getresponse()
        resp_body = resp.read().decode("utf-8", errors="replace")
        return resp.status, dict(resp.getheaders()), resp_body
    except Exception as e:
        return 0, {}, f"ERROR: {e}"
    finally:
        conn.close()


# ── Step 1: 登录 IPPBX200 ───────────────────────────────────
def login_ippbx() -> tuple:
    """
    POST /cgi-bin/luci  →  sysauth cookie + stok token
    Returns: (sysauth, stok) or (None, None)
    """
    print(f"[*] 登录 IPPBX200 ({PBX_IP}) ...")
    body = f"luci_username={PBX_USER}&luci_password={PBX_PASS}"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}

    status, resp_headers, resp_body = pbx_request("POST", "/cgi-bin/luci",
                                                   body=body, headers=headers)

    if status == 0:
        print(f"[!] 请求失败: {resp_body}")
        return None, None

    # 提取 sysauth cookie
    set_cookie = resp_headers.get("Set-Cookie", "") or resp_headers.get("set-cookie", "")
    sysauth = None
    for part in set_cookie.split(";"):
        part = part.strip()
        if part.startswith("sysauth="):
            sysauth = part.split("=", 1)[1]

    # 提取 stok（从 Location 或响应体中）
    location = resp_headers.get("Location", "") or resp_headers.get("location", "")
    stok = None
    m = re.search(r"stok=([a-f0-9]+)", location)
    if m:
        stok = m.group(1)
    else:
        # 有些版本 stok 在响应体里
        m = re.search(r"stok=([a-f0-9]+)", resp_body)
        if m:
            stok = m.group(1)

    if sysauth and stok:
        print(f"[+] 登录成功")
        print(f"    sysauth : {sysauth[:20]}...")
        print(f"    stok    : {stok}")
        return sysauth, stok
    else:
        print(f"[!] 登录失败 (HTTP {status})")
        print(f"    Set-Cookie: {set_cookie[:100]}")
        print(f"    Location  : {location[:100]}")
        print(f"    Body 前200: {resp_body[:200]}")
        return None, None


# ── Step 2: 获取分机配置列表 ─────────────────────────────────
def get_sip_extensions(sysauth: str, stok: str) -> list:
    """
    GET /cgi-bin/luci/;stok={stok}/admin/extension/sip/get
    返回分机列表: [{id, devicenumber, display_name, secret, ...}, ...]
    """
    print(f"\n[*] 获取分机配置列表 ...")
    path = f"/cgi-bin/luci/;stok={stok}/admin/extension/sip/get"
    headers = {"Cookie": f"sysauth={sysauth}"}

    status, _, body = pbx_request("GET", path, headers=headers)

    if status != 200:
        print(f"[!] 请求失败 (HTTP {status})")
        return []

    try:
        data = json.loads(body)
        extensions = data.get("data", data) if isinstance(data, dict) else data
        print(f"[+] 发现 {len(extensions)} 个分机")
        for ext in extensions:
            num = ext.get("devicenumber", ext.get("display_name", "?"))
            print(f"    分机 {num}  (id: {ext.get('id', '?')})")
        return extensions
    except json.JSONDecodeError:
        print(f"[!] JSON 解析失败: {body[:300]}")
        return []


# ── Step 3: 获取 SIP 注册状态 ────────────────────────────────
def get_sip_status(sysauth: str, stok: str) -> list:
    """
    GET /cgi-bin/luci/;stok={stok}/admin/status/sipext/get
    返回分机状态: [{id, devicenumber, address, status, registered, ...}, ...]
    """
    print(f"\n[*] 获取 SIP 注册状态 ...")
    path = f"/cgi-bin/luci/;stok={stok}/admin/status/sipext/get"
    headers = {"Cookie": f"sysauth={sysauth}"}

    status, _, body = pbx_request("GET", path, headers=headers)

    if status != 200:
        print(f"[!] 请求失败 (HTTP {status})")
        return []

    try:
        data = json.loads(body)
        entries = data.get("data", data) if isinstance(data, dict) else data
        print(f"[+] 获取到 {len(entries)} 条状态记录")
        return entries
    except json.JSONDecodeError:
        print(f"[!] JSON 解析失败: {body[:300]}")
        return []


# ── Step 4: 刷新获取实时 IP ──────────────────────────────────
def refresh_sip_status(sysauth: str, stok: str, ids: list) -> list:
    """
    GET /cgi-bin/luci/;stok={stok}/admin/status/sipext/update?ids=xxx,yyy,...
    返回: [{id, address, status, delay, registered}, ...]
    address 格式: "sip:8704@10.21.2.90:5060"  或  "n/a"
    """
    print(f"\n[*] 刷新实时状态 ({len(ids)} 个分机) ...")
    ids_str = ",".join(ids)
    path = f"/cgi-bin/luci/;stok={stok}/admin/status/sipext/update?ids={ids_str}"
    headers = {"Cookie": f"sysauth={sysauth}"}

    status, _, body = pbx_request("GET", path, headers=headers, timeout=30)

    if status != 200:
        print(f"[!] 请求失败 (HTTP {status})")
        return []

    try:
        data = json.loads(body)
        entries = data if isinstance(data, list) else [data]
        print(f"[+] 刷新完成，获取到 {len(entries)} 条记录")
        return entries
    except json.JSONDecodeError:
        print(f"[!] JSON 解析失败: {body[:300]}")
        return []


def parse_ip_from_address(address: str) -> str:
    """
    从 "sip:8704@10.21.2.90:5060" 提取 IP 地址
    """
    if not address or address.lower() == "n/a":
        return ""
    m = re.search(r"@([\d.]+):", address)
    return m.group(1) if m else ""


# ── 主流程 ───────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  ATCOM IPPBX200 设备发现工具")
    print(f"  PBX: {PBX_IP}")
    print("=" * 60)

    # Step 1: 登录
    sysauth, stok = login_ippbx()
    if not sysauth or not stok:
        print("\n[!] 无法登录 IPPBX200，脚本终止")
        sys.exit(1)

    # Step 2: 获取分机配置
    extensions = get_sip_extensions(sysauth, stok)

    # Step 3: 获取 SIP 注册状态
    sip_status = get_sip_status(sysauth, stok)

    # 提取所有分机 ID
    all_ids = []
    for entry in sip_status:
        eid = entry.get("id", "")
        if eid:
            all_ids.append(eid)

    # 如果 sip_status 没有 ID，从 extensions 取
    if not all_ids:
        for ext in extensions:
            eid = ext.get("id", "")
            if eid:
                all_ids.append(eid)

    if not all_ids:
        print("\n[!] 未获取到任何分机 ID，无法刷新状态")
        sys.exit(1)

    # Step 4: 刷新获取实时 IP
    realtime = refresh_sip_status(sysauth, stok, all_ids)

    # ── 汇总结果 ──────────────────────────────────────────────
    # 建立 id -> extension 映射
    ext_map = {}
    for ext in extensions:
        ext_map[ext.get("id", "")] = ext

    # 合并数据
    print("\n" + "=" * 60)
    print("  设备发现结果")
    print("=" * 60)

    devices = []
    online_count = 0
    offline_count = 0

    for entry in realtime:
        eid = entry.get("id", "")
        ext_info = ext_map.get(eid, {})
        extension = entry.get("devicenumber") or ext_info.get("devicenumber", "?")
        address = entry.get("address", "n/a")
        status_text = entry.get("status", "n/a")
        delay = entry.get("delay", "n/a")
        registered = entry.get("registered", "n/a")
        ip = parse_ip_from_address(address)

        is_online = registered == "Avail" or (ip and address != "n/a")

        device = {
            "id": eid,
            "extension": extension,
            "ip": ip,
            "address": address,
            "status": status_text,
            "delay": delay,
            "registered": registered,
            "online": is_online,
            "secret": ext_info.get("secret", ""),
            "display_name": ext_info.get("display_name", ""),
        }
        devices.append(device)

        if is_online:
            online_count += 1
            icon = "🟢"
        else:
            offline_count += 1
            icon = "🔴"

        print(f"  {icon} 分机 {extension:>5}  │  IP: {ip or '--':>15}  │  "
              f"状态: {status_text:>5}  │  延迟: {delay:>6}ms  │  注册: {registered}")

    print("\n" + "-" * 60)
    print(f"  总计: {len(devices)} 台  │  在线: {online_count}  │  离线: {offline_count}")
    print("-" * 60)

    # 保存结果
    output = {
        "pbx": PBX_IP,
        "total": len(devices),
        "online": online_count,
        "offline": offline_count,
        "devices": devices,
    }

    with open("atcom_devices.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n[+] 结果已保存到 atcom_devices.json")

    # 打印原始刷新响应（调试用）
    print("\n" + "=" * 60)
    print("  原始刷新响应（调试）")
    print("=" * 60)
    print(json.dumps(realtime, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
