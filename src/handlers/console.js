// 监控控制台（二开功能）：每台服务器的服务档案 + 服务运行状态
// - 档案（网址、隧穿命令、端口、说明）只在管理员登录后可读写
// - 服务状态由服务器上的 cfsm-console 小脚本定时上报，脚本只用每台服务器独立的只写令牌
// 所有逻辑集中在本文件，尽量少改上游文件，方便同步上游。

import { checkAuth } from '../middleware/auth.js';
import { createSuccessResponse, createBadRequestResponse, createUnauthorizedResponse, createNotFoundResponse } from '../utils/errors.js';

const MAX_PROFILE_BYTES = 64 * 1024;
const MAX_REPORT_BYTES = 48 * 1024;
const DISCOVER_INTERVAL = 600;
const CHECK_TYPES = new Set(['systemd', 'process', 'port', 'docker', 'none']);
const ICONS = ['🖥️', '📁', '📊', '🛡️', '🎯', '🚀', '🌐', '🔐', '🧰', '🐳', '📡', '🗄️', '🤖', '🎬', '🔧', '⚡', '📦', '🔗'];

let tablesReady = false;

async function ensureTables(db) {
  if (tablesReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS console_profiles (
      server_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS console_status (
      server_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      reported_at INTEGER NOT NULL
    )`)
  ]);
  tablesReady = true;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 每台服务器一个只写令牌：只能上报这台服务器的服务状态，拿不到档案内容，也不能上报指标
export async function getReportToken(env, serverId) {
  const hex = await hmacHex(env.API_SECRET, `cfsm-console:${serverId}`);
  return hex.slice(0, 32);
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function str(value, max) {
  if (value === undefined || value === null) return '';
  return String(value).slice(0, max);
}

function randomKey() {
  return Math.random().toString(36).slice(2, 10);
}

export function sanitizeProfile(input) {
  const src = input && typeof input === 'object' ? input : {};
  const blocks = Array.isArray(src.blocks) ? src.blocks.slice(0, 30) : [];
  const services = Array.isArray(src.services) ? src.services.slice(0, 60) : [];
  const ignored = Array.isArray(src.ignored) ? src.ignored.slice(0, 200) : [];
  return {
    // 隧穿设置：密钥路径是用户电脑上的（如 %USERPROFILE%\\.ssh\\dsh-tunnel），只用来拼命令文本
    tunnel: {
      key: str(src.tunnel?.key, 200).replace(/["'`$;&|<>\r\n]/g, ''),
      user: str(src.tunnel?.user, 32).replace(/[^A-Za-z0-9._-]/g, ''),
      host: str(src.tunnel?.host, 253).replace(/[^A-Za-z0-9.:\-\[\]]/g, ''),
      port: str(src.tunnel?.port, 5).replace(/[^0-9]/g, ''),
      ts: src.tunnel?.ts === true
    },
    ignored: [...new Set(ignored.map(x => str(x, 80).replace(/[^A-Za-z0-9@._:\/+=\- ]/g, '')).filter(Boolean))],
    blocks: blocks.map(block => ({
      title: str(block?.title, 80),
      icon: str(block?.icon, 8),
      svc: /^[a-z0-9]{4,16}$/.test(block?.svc || '') ? block.svc : '',
      rows: (Array.isArray(block?.rows) ? block.rows.slice(0, 30) : []).map(row => ({
        label: str(row?.label, 40),
        value: str(row?.value, 1000),
        kind: ['link', 'copy', 'text'].includes(row?.kind) ? row.kind : 'copy',
        note: str(row?.note, 120)
      }))
    })),
    services: services.map(svc => {
      const key = /^[a-z0-9]{4,16}$/.test(svc?.key || '') ? svc.key : randomKey();
      const check = CHECK_TYPES.has(svc?.check) ? svc.check : 'none';
      // 目标只允许服务名/进程名/端口常见字符，脚本端也会再次校验
      const target = str(svc?.target, 80).replace(/[^A-Za-z0-9@._:\/+=\- ]/g, '');
      return {
        key,
        name: str(svc?.name, 60),
        icon: str(svc?.icon, 8),
        desc: str(svc?.desc, 160),
        check,
        target: check === 'port' ? target.replace(/[^0-9]/g, '').slice(0, 5) : target,
        // 可选：手动指定访问端口（服务有多个端口时用）
        port: str(svc?.port, 5).replace(/[^0-9]/g, '')
      };
    })
  };
}

async function serverExists(db, id) {
  const row = await db.prepare('SELECT id FROM servers WHERE id = ?').bind(id).first();
  return !!row;
}

async function readJsonRow(db, table, column, id) {
  const row = await db.prepare(`SELECT data, ${column} AS ts FROM ${table} WHERE server_id = ?`).bind(id).first();
  if (!row) return { data: null, ts: 0 };
  try {
    return { data: JSON.parse(row.data), ts: row.ts };
  } catch (_) {
    return { data: null, ts: row.ts };
  }
}

// POST /console/api  { action: 'get' | 'save', id, profile? }
export async function handleConsoleAPI(request, env, sys) {
  if (!await checkAuth(request, env, sys)) {
    return createUnauthorizedResponse();
  }
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_PROFILE_BYTES + 1024) return createBadRequestResponse('profileTooLarge');
    body = JSON.parse(text || '{}');
  } catch (_) {
    return createBadRequestResponse('invalidJson');
  }
  await ensureTables(env.DB);

  // 总览：所有服务器的服务状态汇总（不返回档案里的命令和网址）
  if (body?.action === 'overview') {
    const [profiles, statuses] = await Promise.all([
      env.DB.prepare('SELECT server_id, data FROM console_profiles').all(),
      env.DB.prepare('SELECT server_id, data, reported_at FROM console_status').all()
    ]);
    const statusMap = {};
    for (const row of statuses.results || []) {
      try { statusMap[row.server_id] = { data: JSON.parse(row.data), reported_at: row.reported_at }; } catch (_) {}
    }
    const result = {};
    for (const row of profiles.results || []) {
      let profile;
      try { profile = JSON.parse(row.data); } catch (_) { continue; }
      const st = statusMap[row.server_id] || { data: {}, reported_at: 0 };
      result[row.server_id] = {
        reported_at: st.reported_at,
        blocks: (profile.blocks || []).length,
        services: (profile.services || []).map(s => ({
          name: s.name,
          icon: s.icon,
          check: s.check,
          state: s.check && s.check !== 'none' ? (st.data?.[s.key] || null) : 'none'
        }))
      };
    }
    return createSuccessResponse({ servers: result, now: Math.floor(Date.now() / 1000) });
  }

  const id = str(body?.id, 64);
  if (!id) return createBadRequestResponse('Missing ID');
  if (!await serverExists(env.DB, id)) return createNotFoundResponse('Server not found');

  if (body.action === 'get') {
    const [profile, status, token] = await Promise.all([
      readJsonRow(env.DB, 'console_profiles', 'updated_at', id),
      readJsonRow(env.DB, 'console_status', 'reported_at', id),
      getReportToken(env, id)
    ]);
    return createSuccessResponse({
      profile: profile.data || { blocks: [], services: [] },
      updated_at: profile.ts,
      status: status.data || {},
      reported_at: status.ts,
      report_token: token,
      icons: ICONS
    });
  }

  if (body.action === 'save') {
    const profile = sanitizeProfile(body.profile);
    const data = JSON.stringify(profile);
    if (data.length > MAX_PROFILE_BYTES) return createBadRequestResponse('profileTooLarge');
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `INSERT INTO console_profiles (server_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(server_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
    ).bind(id, data, now).run();
    return createSuccessResponse({ success: true, profile, updated_at: now });
  }

  return createBadRequestResponse('Unknown action');
}

function textResponse(text, status = 200) {
  return new Response(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function authReport(url, env) {
  const id = str(url.searchParams.get('id'), 64);
  const token = str(url.searchParams.get('token'), 64);
  if (!id || !token) return null;
  const expected = await getReportToken(env, id);
  return timingSafeEqual(token, expected) ? id : null;
}

// GET  /console/report?id=&token=  → 返回要检查的服务清单（每行：key<TAB>类型<TAB>目标）
// POST /console/report?id=&token=  ← 上报结果（每行：key<TAB>状态）
export async function handleConsoleReport(request, env) {
  const url = new URL(request.url);
  const id = await authReport(url, env);
  if (!id) return textResponse('unauthorized\n', 401);
  await ensureTables(env.DB);

  const [{ data: profile }, { data: prevStatus }] = await Promise.all([
    readJsonRow(env.DB, 'console_profiles', 'updated_at', id),
    readJsonRow(env.DB, 'console_status', 'reported_at', id)
  ]);
  const services = (profile?.services || []).filter(s => s.check && s.check !== 'none' && s.target);
  const nowSec = Math.floor(Date.now() / 1000);
  const prevDisc = prevStatus?._disc;

  if (request.method === 'GET') {
    const lines = services.map(s => `${s.key}\t${s.check}\t${s.target}`);
    // 自动发现每 10 分钟做一次，由服务端决定，脚本看到 #discover 才扫描
    const agentV = parseInt(url.searchParams.get('v') || '1', 10) || 1;
    // 脚本升级后（v 变大）立刻重扫一次，不用等 10 分钟
    if (!prevDisc || nowSec - (prevDisc.at || 0) > DISCOVER_INTERVAL || agentV > (prevDisc.v || 1)) lines.unshift('#discover');
    return textResponse(lines.join('\n') + (lines.length ? '\n' : ''));
  }

  const text = await request.text();
  if (text.length > MAX_REPORT_BYTES) return textResponse('too large\n', 413);
  const known = new Set(services.map(s => s.key));
  const result = {};
  const disc = { at: nowSec, v: Math.min(parseInt(url.searchParams.get('v') || '1', 10) || 1, 99), units: [], procs: [], ports: [], containers: [], sites: [], listen: [], tsip: '' };
  let sawDisc = false;
  const clean = (v, max) => str(v, max).replace(/[^A-Za-z0-9@._:\/+=\- ]/g, '');
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const parts = line.split('\t');
    if (parts[0] === '#disc') { sawDisc = true; continue; }
    if (parts[0] === '#unit' && disc.units.length < 200) {
      const name = clean(parts[1], 80);
      if (name) disc.units.push([name, str(parts[2], 120)]);
      continue;
    }
    if (parts[0] === '#proc' && disc.procs.length < 300) {
      const name = clean(parts[1], 40);
      if (name && !disc.procs.includes(name)) disc.procs.push(name);
      continue;
    }
    if (parts[0] === '#ctr' && disc.containers.length < 200) {
      const name = str(parts[1], 64).replace(/[^A-Za-z0-9_.\-]/g, '');
      const image = str(parts[2], 160).replace(/[^A-Za-z0-9_.\-\/:@]/g, '');
      const state = str(parts[3], 20).replace(/[^a-z]/g, '');
      // 只留宿主机映射端口号，如 0.0.0.0:8000->8000/tcp → 8000
      const hostPorts = [...new Set([...String(parts[4] || '').matchAll(/(?:^|[ ,])\[?([0-9a-fA-F.:]*?)\]?:(\d{1,5})->/g)].map(m => `${m[1] || '0.0.0.0'}|${m[2]}`))].slice(0, 20);
      if (name) disc.containers.push([name, image, state, hostPorts]);
      continue;
    }
    if (parts[0] === '#lsn' && disc.listen.length < 300) {
      const bind = str(parts[1], 46).replace(/[^0-9a-fA-F.:*]/g, '');
      const port = str(parts[2], 5).replace(/[^0-9]/g, '');
      const proc = str(parts[3], 40).replace(/[^A-Za-z0-9@._:+\-]/g, '');
      const unit = str(parts[4], 80).replace(/[^A-Za-z0-9@._:+\-]/g, '');
      if (port) disc.listen.push([bind, port, proc === '-' ? '' : proc, unit === '-' ? '' : unit]);
      continue;
    }
    if (parts[0] === '#addr' && parts[1] === 'ts') {
      const ip = str(parts[2], 15);
      if (/^100\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) disc.tsip = ip;
      continue;
    }
    if (parts[0] === '#site' && disc.sites.length < 100) {
      const host = str(parts[1], 253).toLowerCase();
      const port = str(parts[2], 5).replace(/[^0-9]/g, '');
      if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(host) && port) disc.sites.push([host, port]);
      continue;
    }
    if (parts[0] === '#port' && disc.ports.length < 200) {
      const port = parseInt(parts[1], 10);
      if (port > 0 && port < 65536 && !disc.ports.includes(port)) disc.ports.push(port);
      continue;
    }
    const key = parts[0].trim();
    if (!key || !known.has(key)) continue;
    result[key] = str(parts[1], 20).replace(/[^a-z\-]/g, '') || 'unknown';
  }
  if (sawDisc) result._disc = disc;
  else if (prevDisc) result._disc = prevDisc;
  const now = nowSec;
  await env.DB.prepare(
    `INSERT INTO console_status (server_id, data, reported_at) VALUES (?, ?, ?)
     ON CONFLICT(server_id) DO UPDATE SET data = excluded.data, reported_at = excluded.reported_at`
  ).bind(id, JSON.stringify(result), now).run();
  return textResponse('ok\n');
}

// GET /console/agent.sh → 服务器端小脚本（不含任何密钥，安装时由参数传入）
export function handleConsoleAgentScript() {
  return new Response(AGENT_SCRIPT, {
    headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

const AGENT_SCRIPT = `#!/bin/sh
# cfsm-console agent：只读检查服务状态并上报到你的探针 Worker
# - 不监听任何端口，不接收也不执行任何远程命令
# - 只做四种检查：systemctl is-active / pgrep -f / 本机监听端口 / Docker 容器状态
# - Docker：root 只执行固定的 docker ps -a（名字、镜像、状态、端口映射）写到 /run，脚本本体不接触 docker.sock
# - 监听端口：root 用 ss -ltnp 把端口对应到进程名和 systemd 服务名（不读命令行）
# - 反代：root 只从 Caddy/Nginx 配置里摘「域名 → 端口」写到 /run，证书、密码、其他配置一概不读不传
# - 每 10 分钟做一次自动发现：列出运行中的服务名、进程名、监听端口（不读命令行参数、配置或密码）
# 用法：
#   安装（systemd，root 执行）：sh agent.sh install <WORKER_URL> <SERVER_ID> <TOKEN>
#   无 systemd 的容器：        sh agent.sh loop <WORKER_URL> <SERVER_ID> <TOKEN> &
#   单次运行：                  sh agent.sh run <WORKER_URL> <SERVER_ID> <TOKEN>
#   卸载：                      sh agent.sh uninstall
set -u
DIR=/opt/cfsm-console

check_one() {
  type="$1"; target="$2"
  case "$target" in *[!A-Za-z0-9@._:/+=\\ -]*) echo invalid; return;; esac
  case "$type" in
    systemd)
      st=$(systemctl is-active "$target" 2>/dev/null); [ -n "$st" ] || st=unknown; echo "$st";;
    process)
      if pgrep -f -- "$target" >/dev/null 2>&1; then echo active; else echo inactive; fi;;
    port)
      case "$target" in *[!0-9]*) echo invalid; return;; esac
      if command -v ss >/dev/null 2>&1; then
        ss -ltnuH 2>/dev/null | awk '{print $5}' | grep -qE "[:.]$target\$" && { echo active; return; }
      elif command -v netstat >/dev/null 2>&1; then
        netstat -ltnu 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$target\$" && { echo active; return; }
      else
        echo unknown; return
      fi
      echo inactive;;
    docker)
      list=$(containers) || { echo unknown; return; }
      [ -n "$list" ] || { echo unknown; return; }
      st=$(printf '%s\\n' "$list" | awk -F '\\t' -v n="$target" '$1==n{print $3; exit}')
      case "$st" in running) echo active;; "") echo inactive;; *) echo "$st";; esac;;
    *) echo unknown;;
  esac
}

CTR_FILE=/run/cfsm-console/containers

# Docker 容器清单（名字、镜像、状态）。systemd 安装时由 root 预先执行固定的 docker ps 写到 $CTR_FILE，
# 脚本本身仍以 nobody 运行、不碰 docker.sock；loop 模式下当前用户能用 docker 就直接读
containers() {
  if [ -r "$CTR_FILE" ]; then cat "$CTR_FILE"; return 0; fi
  command -v docker >/dev/null 2>&1 && docker ps -a --format '{{.Names}}\\t{{.Image}}\\t{{.State}}\\t{{.Ports}}' 2>/dev/null
}

SITE_FILE=/run/cfsm-console/sites
LSN_FILE=/run/cfsm-console/listen

# 监听端口 → 进程名 → 所属 systemd 服务（只有 root 能看到别的用户的进程，所以放在 collect 里跑）
listen_scan() {
  command -v ss >/dev/null 2>&1 || return 0
  tab=$(printf '\\t')
  ss -ltnpH 2>/dev/null | awk '{
    loc = $4; p = loc; sub(/.*:/, "", p); b = loc; sub(/:[0-9]+$/, "", b); gsub(/[][]/, "", b); sub(/%.*/, "", b)
    name = "-"; pid = "-"
    if (match($0, /\\(\\("[^"]+",pid=[0-9]+/)) { s = substr($0, RSTART + 3, RLENGTH - 3); name = s; sub(/".*/, "", name); pid = s; sub(/.*pid=/, "", pid) }
    if (p ~ /^[0-9]+$/) print b "\\t" p "\\t" name "\\t" pid
  }' | while IFS="$tab" read -r b p name pid; do
    unit="-"
    if [ "$pid" != "-" ] && [ -r "/proc/$pid/cgroup" ]; then
      u=$(grep -o '[A-Za-z0-9@._-]*\\.service' "/proc/$pid/cgroup" 2>/dev/null | tail -n 1)
      [ -n "$u" ] && unit=\${u%.service}
    fi
    printf '%s\\t%s\\t%s\\t%s\\n' "$b" "$p" "$name" "$unit"
  done | sort -u
}

listens() {
  if [ -r "$LSN_FILE" ]; then cat "$LSN_FILE"; return 0; fi
  listen_scan 2>/dev/null
}

ts_ip() {
  command -v ip >/dev/null 2>&1 || return 0
  ip -4 -o addr show tailscale0 2>/dev/null | awk '{ split($4, a, "/"); print a[1]; exit }'
}


# 反代里的「域名 → 本机端口」：只从 Caddy/Nginx 配置里摘 站点地址 和 反代端口 两样，其他内容一概不读不传
# 反代上游是否在本机：只认 localhost/回环/空主机/本机网卡 IP，指向别的机器的一律丢掉
local_ips() {
  { echo localhost; echo 127.0.0.1; echo ::1; echo 0.0.0.0; ip -o addr show 2>/dev/null | awk '{ split($4, a, "/"); print a[1] }'; } | tr '\\n' ' '
}

site_scan() {
  LIPS=" $(local_ips) "
  # Caddyfile：/etc/caddy 下所有文件（含 import 进来的子目录），兼容 Windows 换行
  find /etc/caddy -maxdepth 3 -type f 2>/dev/null | head -n 50 | while IFS= read -r f; do
    [ -r "$f" ] || continue
    case "$f" in *.json|*.crt|*.key|*.pem) continue ;; esac
    awk -v lips="$LIPS" '
      { sub(/\\r$/, ""); sub(/#.*/, ""); line = $0 }
      depth == 0 && line ~ /\\{[ \\t]*$/ {
        addr = line; sub(/\\{[ \\t]*$/, "", addr); n = split(addr, a, /[ ,\\t]+/); host = ""
        for (i = 1; i <= n; i++) { h = a[i]; sub(/^https?:\\/\\//, "", h); sub(/:[0-9]+$/, "", h); sub(/\\/.*/, "", h)
          if (h ~ /^[A-Za-z0-9*][A-Za-z0-9.-]*\\.[A-Za-z][A-Za-z]+$/) { host = h; break } }
      }
      depth >= 1 && host != "" && $1 == "reverse_proxy" {
        for (i = 2; i <= NF; i++) { u = $i; if (u ~ /^[@\\/{]/) continue; sub(/^https?:\\/\\//, "", u); sub(/\\/.*/, "", u)
          if (match(u, /:[0-9]+$/)) { uh = substr(u, 1, RSTART - 1); gsub(/[\\[\\]]/, "", uh)
            if (uh == "" || uh ~ /^127\\./ || index(lips, " " uh " ")) print host "\\t" substr(u, RSTART + 1); break } }
      }
      { o = gsub(/\\{/, "{", line); c = gsub(/\\}/, "}", line); depth += o - c; if (depth <= 0) { depth = 0; if (c > 0) host = "" } }
    ' "$f"
  done
  # Caddy 管理接口（本机 2019，只读）：配置不在 /etc/caddy 时（如 Docker 里的 Caddy）也能拿到，只摘域名和上游端口
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -m 3 http://127.0.0.1:2019/config/ 2>/dev/null | head -c 2000000 | tr ',{}[]' '\\n\\n\\n\\n\\n' | awk -v lips="$LIPS" -F '"' '
      $2 == "host" { want = 1; next }
      want && NF >= 2 && $2 ~ /^[A-Za-z0-9*][A-Za-z0-9.-]*\\.[A-Za-z][A-Za-z]+$/ { host = $2; next }
      { want = 0 }
      $2 == "dial" && host != "" { u = $4; if (match(u, /:[0-9]+$/)) { uh = substr(u, 1, RSTART - 1); gsub(/[\\[\\]]/, "", uh)
        if (uh == "" || uh ~ /^127\\./ || index(lips, " " uh " ")) print host "\\t" substr(u, RSTART + 1) } }
    '
  fi
  for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    [ -f "$f" ] && [ -r "$f" ] || continue
    awk -v lips="$LIPS" '
      { sub(/#.*/, "") }
      $1 == "server" && $0 ~ /\\{/ { host = "" }
      $1 == "server_name" { for (i = 2; i <= NF; i++) { h = $i; sub(/;$/, "", h); if (h ~ /^[A-Za-z0-9][A-Za-z0-9.-]*\\.[A-Za-z][A-Za-z]+$/) { host = h; break } } }
      host != "" { for (k = 1; k < NF; k++) if ($k == "proxy_pass") { u = $(k + 1); sub(/;.*$/, "", u); sub(/^https?:\\/\\//, "", u); sub(/\\/.*/, "", u); if (match(u, /:[0-9]+$/)) { uh = substr(u, 1, RSTART - 1); gsub(/[\\[\\]]/, "", uh); if (uh == "" || uh ~ /^127\\./ || index(lips, " " uh " ")) print host "\\t" substr(u, RSTART + 1) } } }
    ' "$f"
  done
}

sites() {
  if [ -r "$SITE_FILE" ]; then cat "$SITE_FILE"; return 0; fi
  site_scan 2>/dev/null
}

collect() {
  mkdir -p /run/cfsm-console
  site_scan 2>/dev/null | head -n 100 > /run/cfsm-console/sites.tmp
  chmod 644 /run/cfsm-console/sites.tmp
  mv -f /run/cfsm-console/sites.tmp "$SITE_FILE"
  listen_scan 2>/dev/null | head -n 300 > /run/cfsm-console/listen.tmp
  chmod 644 /run/cfsm-console/listen.tmp
  mv -f /run/cfsm-console/listen.tmp "$LSN_FILE"
  command -v docker >/dev/null 2>&1 || return 0
  docker ps -a --format '{{.Names}}\\t{{.Image}}\\t{{.State}}\\t{{.Ports}}' > /run/cfsm-console/containers.tmp 2>/dev/null || { rm -f /run/cfsm-console/containers.tmp; return 0; }
  chmod 644 /run/cfsm-console/containers.tmp
  mv -f /run/cfsm-console/containers.tmp "$CTR_FILE"
}

# 自动发现：只读列出正在运行的 systemd 服务、进程名、本机监听端口（不含命令行参数）
discover() {
  printf '#disc\\n'
  if command -v systemctl >/dev/null 2>&1; then
    systemctl list-units --type=service --state=running --no-legend --plain 2>/dev/null | head -n 200 |
      awk '{u=$1; $1=$2=$3=$4=""; sub(/^ +/, ""); printf "#unit\\t%s\\t%s\\n", u, $0}'
  fi
  containers | head -n 200 | awk -F '\\t' 'NF>=3{printf "#ctr\\t%s\\t%s\\t%s\\t%s\\n", $1, $2, $3, $4}'
  sites | head -n 100 | awk -F '\\t' 'NF>=2{printf "#site\\t%s\\t%s\\n", $1, $2}'
  listens | head -n 300 | awk -F '\\t' 'NF>=4{printf "#lsn\\t%s\\t%s\\t%s\\t%s\\n", $1, $2, $3, $4}'
  t=$(ts_ip)
  if [ -n "$t" ]; then printf '#addr\\tts\\t%s\\n' "$t"; fi
  ps -eo ppid=,comm= 2>/dev/null | awk '$1 != 0 && $1 != 2 {print $2}' | sort -u | head -n 300 | awk '{printf "#proc\\t%s\\n", $1}'
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH 2>/dev/null | awk '{print $4}'
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk 'NR>2{print $4}'
  else
    for f in /proc/net/tcp /proc/net/tcp6; do
      [ -r "$f" ] && awk 'NR>1 && $4=="0A"{split($2,a,":"); print a[2]}' "$f" | while read -r h; do printf ':%d\\n' "0x$h"; done
    done
  fi | sed 's/.*[:.]//' | grep -E '^[0-9]+$' | sort -un | head -n 200 | awk '{printf "#port\\t%s\\n", $1}'
}

run_once() {
  url="$1"; id="$2"; token="$3"
  q="id=$id&token=$token&v=6"
  list=$(curl -fsS -m 15 -A cfsm-console "$url/console/report?$q") || return 0
  out=""
  tab=$(printf '\\t')
  case "$list" in "#discover"*) out="$(discover)
";; esac
  while IFS="$tab" read -r key type target; do
    [ -n "$key" ] || continue
    [ "$key" = "#discover" ] && continue
    st=$(check_one "$type" "$target")
    out="$out$key$tab$st
"
  done <<EOF
$list
EOF
  printf '%s' "$out" | curl -fsS -m 15 -A cfsm-console -X POST -H 'Content-Type: text/plain' --data-binary @- "$url/console/report?$q" >/dev/null || true
}

case "\${1:-}" in
  run) run_once "$2" "$3" "$4";;
  collect) collect;;
  loop)
    while true; do run_once "$2" "$3" "$4"; sleep "\${CFSM_CONSOLE_INTERVAL:-60}"; done;;
  install)
    [ "$(id -u)" = 0 ] || { echo "请用 root 执行（sudo）"; exit 1; }
    command -v systemctl >/dev/null 2>&1 || { echo "没有 systemd，请改用 loop 模式"; exit 1; }
    mkdir -p "$DIR"
    curl -fsSL -A cfsm-console "$2/console/agent.sh" -o "$DIR/agent.sh"
    chmod 755 "$DIR/agent.sh"
    umask 077
    printf 'URL=%s\\nID=%s\\nTOKEN=%s\\n' "$2" "$3" "$4" > "$DIR/env"
    cat > /etc/systemd/system/cfsm-console.service <<UNIT
[Unit]
Description=cfsm-console service status reporter
After=network-online.target
[Service]
Type=oneshot
User=nobody
EnvironmentFile=$DIR/env
RuntimeDirectory=cfsm-console
ExecStartPre=+/bin/sh $DIR/agent.sh collect
ExecStart=/bin/sh $DIR/agent.sh run \\\${URL} \\\${ID} \\\${TOKEN}
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
UNIT
    cat > /etc/systemd/system/cfsm-console.timer <<UNIT
[Unit]
Description=Run cfsm-console every minute
[Timer]
OnBootSec=30
OnUnitActiveSec=60
AccuracySec=5
[Install]
WantedBy=timers.target
UNIT
    systemctl daemon-reload
    systemctl enable --now cfsm-console.timer
    systemctl start cfsm-console.service || true
    echo "cfsm-console 已安装：每 60 秒上报一次服务状态";;
  uninstall)
    systemctl disable --now cfsm-console.timer 2>/dev/null || true
    rm -f /etc/systemd/system/cfsm-console.timer /etc/systemd/system/cfsm-console.service
    systemctl daemon-reload 2>/dev/null || true
    rm -rf "$DIR"
    echo "cfsm-console 已卸载";;
  *) echo "用法：sh agent.sh install|run|loop <WORKER_URL> <SERVER_ID> <TOKEN> | uninstall"; exit 1;;
esac
`;
