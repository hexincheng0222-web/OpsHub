#!/usr/bin/env bash
# Status line HUD for OpsHub — v3 with cache & cost
input=$(cat)

result=$(python -c "
# -*- coding: utf-8 -*-
import sys, io, json, re, os, subprocess
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')

raw = sys.stdin.read()
raw = re.sub(r'\"((?:[A-Za-z]:\\\\|\\\\\\\\)[^\"]*)\"', lambda m: '\"' + m.group(1).replace('\\\\', '/') + '\"', raw)

try:
    data = json.loads(raw)
except:
    data = {}

parts = []

# 1. Model 🤖
model = data.get('model', {}).get('display_name', '') or os.environ.get('CLAUDE_MODEL', '') or 'unknown'
parts.append(f'🤖 {model}')

# 2. Git branch 🌿
branch = data.get('workspace', {}).get('git_branch', '')
if not branch:
    try:
        branch = subprocess.check_output(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], stderr=subprocess.DEVNULL).decode().strip()
    except:
        pass
if branch:
    parts.append(f'🌿 {branch}')

# 3. Context usage + progress bar 📊
ctx = data.get('context_window', {}).get('used_percentage')
if ctx is not None:
    pct = int(float(str(ctx)))
    bar_len = 12
    filled = round(pct / 100 * bar_len)
    bar = '█' * filled + '░' * (bar_len - filled)
    if pct < 50:
        indicator = f'🟢 {pct}%'
    elif pct < 80:
        indicator = f'🟡 {pct}%'
    else:
        indicator = f'🔴 {pct}%'
    parts.append(f'📊 {indicator} {bar}')

# 4. Tokens: 总输入/输出 + 缓存命中率 📝
def fmt(n):
    if not n: return '0'
    n = int(n)
    if n >= 1000000: return f'{n/1000000:.1f}M'
    if n >= 1000: return f'{n/1000:.1f}k'
    return str(n)

cw = data.get('context_window', {})
usage = cw.get('current_usage', {})
inp = cw.get('total_input_tokens', 0) or usage.get('input_tokens', 0)
out = cw.get('total_output_tokens', 0) or usage.get('output_tokens', 0)
cache_read = usage.get('cache_read_input_tokens', 0)
cache_create = usage.get('cache_creation_input_tokens', 0)

token_parts = []
if inp: token_parts.append(f'输入:{fmt(inp)}')
if out: token_parts.append(f'输出:{fmt(out)}')
if cache_read and inp:
    cache_pct = cache_read / inp * 100
    token_parts.append(f'缓存命中:{fmt(cache_read)}({cache_pct:.2f}%)')
elif cache_read:
    token_parts.append(f'缓存命中:{fmt(cache_read)}')
if cache_create: token_parts.append(f'缓存写入:{fmt(cache_create)}')

if token_parts:
    parts.append('📝 ' + ' '.join(token_parts))

print('  '.join(parts))
" <<< "$input")

echo "$result"
