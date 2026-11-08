// 二开：自动发现对照表 —— 把 systemd 服务名 / 进程名翻译成正式名称
// re 同时匹配 systemd 服务名（去掉 .service）和进程名；先匹配到的规则生效
export const KNOWN_SERVICES = [
  { id: 'sillytavern', re: /^(sillytavern|silly-tavern|st|tavern|jiuguan)$/i, name: 'SillyTavern 酒馆', icon: '🍺', desc: 'AI 角色扮演前端' },
  { id: 'magpie', re: /^magpie/i, name: 'Magpie', icon: '🤖', desc: '' },
  { id: 'deepseek', re: /^(deepseek.*|ds2api|deepseek2api|deepseek-free-api)$/i, name: 'DeepSeek API 转接', icon: '🤖', desc: '' },
  { id: 'new-api', re: /^(new-api|one-api|veloera|done-hub)$/i, name: 'New API / One API 中转', icon: '🔀', desc: '' },
  { id: 'open-webui', re: /^open-webui$/i, name: 'Open WebUI', icon: '💬', desc: '' },
  { id: 'lobe-chat', re: /^lobe-?chat(-database)?$/i, name: 'LobeChat', icon: '💬', desc: '' },
  { id: 'npm', re: /^nginx-proxy-manager$/i, name: 'Nginx Proxy Manager', icon: '🌐', desc: '' },
  { id: 'portainer', re: /^portainer(-ce|-ee)?$/i, name: 'Portainer 容器管理', icon: '🐳', desc: '' },
  { id: 'watchtower', re: /^watchtower$/i, name: 'Watchtower 自动更新', icon: '🐳', desc: '' },
  { id: 'vaultwarden', re: /^(vaultwarden|bitwarden)(-server)?$/i, name: 'Vaultwarden 密码库', icon: '🔐', desc: '' },
  { id: 'n8n', re: /^n8n$/i, name: 'n8n 自动化', icon: '⚡', desc: '' },
  { id: 'qinglong', re: /^qinglong$/i, name: '青龙面板', icon: '🧰', desc: '' },
  { id: 'x-ui', re: /^(x-ui|3x-ui)$/i, name: '3x-ui 面板', icon: '🔐', desc: 'Xray 多协议管理面板' },
  { id: 'xray', re: /^xray$/i, name: 'Xray 代理核心', icon: '🚀', desc: 'VLESS / VMess / Trojan / Reality' },
  { id: 'sing-box', re: /^sing-box$/i, name: 'Sing-box 网络加速核心', icon: '🚀', desc: 'VLESS-Reality / Hysteria2 / TUIC' },
  { id: 'hysteria', re: /^(hysteria|hysteria-server|hysteria2)$/i, name: 'Hysteria2', icon: '🚀', desc: 'QUIC 代理' },
  { id: 'v2ray', re: /^v2ray$/i, name: 'V2Ray', icon: '🚀', desc: '代理核心' },
  { id: 'mihomo', re: /^(mihomo|clash|clash-meta)$/i, name: 'Mihomo / Clash', icon: '🚀', desc: '代理客户端' },
  { id: 'nginx', re: /^nginx$/i, name: 'Nginx 网页与反代服务', icon: '🌐', desc: 'HTTP / HTTPS 反代' },
  { id: 'caddy', re: /^caddy$/i, name: 'Caddy 网页服务', icon: '🌐', desc: '自动 HTTPS 反代' },
  { id: 'apache', re: /^(apache2|httpd)$/i, name: 'Apache 网页服务', icon: '🌐', desc: '' },
  { id: 'openresty', re: /^openresty$/i, name: 'OpenResty', icon: '🌐', desc: '' },
  { id: 'rustdesk', re: /^(hbbs|hbbr|rustdesk-hbbs|rustdesk-hbbr|rustdesksignal|rustdeskrelay)$/i, name: 'RustDesk 远程桌面中继', icon: '🖥️', desc: 'hbbs / hbbr' },
  { id: 'nezha-agent', re: /^nezha-agent$/i, name: '哪吒监控 Agent', icon: '📊', desc: '' },
  { id: 'nezha-dashboard', re: /^(nezha-dashboard|nezha)$/i, name: '哪吒监控面板 (Nezha Monitor)', icon: '📊', desc: '' },
  { id: 'komari', re: /^komari(-agent)?$/i, name: 'Komari 监控', icon: '📊', desc: '' },
  { id: 'cf-probe', re: /^(cf-server-monitor|cf-probe|cfsm-agent|cf-monitor)$/i, name: 'CF 探针 Agent', icon: '📡', desc: '' },
  { id: 'uptime-kuma', re: /^uptime-kuma$/i, name: 'Uptime Kuma', icon: '📊', desc: '' },
  { id: 'alist', re: /^alist$/i, name: 'AList 网盘与 WebDAV', icon: '📁', desc: '' },
  { id: 'openlist', re: /^openlist$/i, name: 'OpenList 网盘', icon: '📁', desc: '' },
  { id: 'cloudreve', re: /^cloudreve$/i, name: 'Cloudreve 网盘', icon: '📁', desc: '' },
  { id: 'filebrowser', re: /^filebrowser$/i, name: 'File Browser', icon: '📁', desc: '' },
  { id: 'cloudflared', re: /^cloudflared$/i, name: 'Cloudflare Tunnel 隧道', icon: '🔗', desc: 'cloudflared' },
  { id: 'frps', re: /^frps$/i, name: 'FRP 服务端', icon: '🔗', desc: '内网穿透' },
  { id: 'frpc', re: /^frpc$/i, name: 'FRP 客户端', icon: '🔗', desc: '内网穿透' },
  { id: 'tailscale', re: /^tailscaled$/i, name: 'Tailscale', icon: '🔗', desc: '组网' },
  { id: 'zerotier', re: /^zerotier-one$/i, name: 'ZeroTier', icon: '🔗', desc: '组网' },
  { id: 'wireguard', re: /^wg-quick@.+$/i, name: 'WireGuard', icon: '🔐', desc: '' },
  { id: 'docker', re: /^(docker|dockerd)$/i, name: 'Docker 容器引擎', icon: '🐳', desc: '' },
  { id: '1panel', re: /^1panel(-core|-agent)?$/i, name: '1Panel 面板', icon: '🧰', desc: '' },
  { id: 'bt', re: /^(bt|BT-Panel|BT-Task)$/i, name: '宝塔面板', icon: '🧰', desc: '' },
  { id: 'mysql', re: /^(mysql|mysqld|mariadb|mariadbd)$/i, name: 'MySQL / MariaDB 数据库', icon: '🗄️', desc: '' },
  { id: 'postgres', re: /^(postgresql(@.+)?|postgres)$/i, name: 'PostgreSQL 数据库', icon: '🗄️', desc: '' },
  { id: 'redis', re: /^(redis|redis-server)$/i, name: 'Redis', icon: '🗄️', desc: '' },
  { id: 'hermes', re: /^hermes(-gateway|-agent)?(-.*)?$/i, name: 'Hermes Agent 网关', icon: '🤖', desc: '' },
  { id: 'keepalive', re: /^(keepalive|keep-alive|lookbusy|oci-keepalive)$/i, name: '甲骨文防回收保活', icon: '🛡️', desc: '' },
  { id: 'qbittorrent', re: /^qbittorrent(-nox)?(@.+)?$/i, name: 'qBittorrent', icon: '📦', desc: '' },
  { id: 'aria2', re: /^aria2c?$/i, name: 'Aria2 下载', icon: '📦', desc: '' },
  { id: 'jellyfin', re: /^jellyfin$/i, name: 'Jellyfin 影音', icon: '🎬', desc: '' },
  { id: 'emby', re: /^emby-server$/i, name: 'Emby 影音', icon: '🎬', desc: '' },
  { id: 'sshd', re: /^(ssh|sshd)$/i, name: 'SSH 服务 (sshd)', icon: '🔧', desc: 'SSH 登录入口' },
  { id: 'fail2ban', re: /^fail2ban(-server)?$/i, name: 'Fail2ban 防爆破', icon: '🛡️', desc: '' }
]

// 系统自带、不值得进档案的服务
const NOISE = [
  /^systemd-/, /^dbus/, /^cron$/, /^crond$/, /^atd$/, /^rsyslog$/, /^syslog/, /^polkit/, /^getty@/, /^serial-getty@/,
  /^snapd/, /^snap\./, /^unattended-upgrades$/, /^ModemManager$/, /^networkd-dispatcher$/, /^multipathd$/, /^irqbalance$/,
  /^udisks2$/, /^accounts-daemon$/, /^chrony/, /^ntp/, /^qemu-guest-agent$/, /^oracle-cloud-agent/, /^google-/, /^cloud-/,
  /^packagekit$/, /^rpcbind$/, /^user@/, /^fwupd$/, /^thermald$/, /^upower$/, /^wpa_supplicant$/, /^NetworkManager/,
  /^iscsid$/, /^open-vm-tools$/, /^vmtoolsd$/, /^cfsm-console$/, /^containerd$/, /^lvm2/, /^blk-availability$/, /^apport$/,
  /^lxcfs$/, /^acpid$/, /^ssh-agent$/, /^gpg-agent$/, /^modprobe@/, /^sysstat$/, /^nftables$/, /^e2scrub/, /^ec2-instance-connect/, /^chronyd$/, /^iptables/, /^netfilter/, /^ufw$/, /^firewalld$/, /^haveged$/, /^rngd$/, /^auditd$/, /^tuned$/, /^kdump/,
  /^logind$/, /^uuidd$/, /^nscd$/, /^nslcd$/, /^sssd/, /^hv-kvp/, /^waagent$/, /^walinuxagent$/, /^amazon-ssm-agent$/,
  /^snap-/, /^rc-local$/, /^console-/, /^keyboard-/, /^setvtrgb$/, /^plymouth/, /^mdmonitor$/, /^smartd$/, /^hostguard/,
  /^uniagent/, /^telescope$/, /^aliyun/, /^AliYunDun/, /^tat_agent$/, /^YDService$/, /^qcloud/, /^stargate/, /^barad_agent$/
]
// 容器里没有 systemd 时，进程名也作为“未识别”候选，这些忽略
const PROC_NOISE = /^(sh|bash|dash|ash|zsh|sleep|ps|sort|awk|head|grep|sed|curl|wget|init|tini|dumb-init|s6-.*|runsv.*|login|agetty|sudo|su|tmux.*|screen|sshd-session|cat|tail|less|top|htop|vi|vim|nano|python\d*(\.\d+)?|node|perl|cfsm-console)$/i

const strip = (u) => String(u || '').replace(/\.service$/, '')

export const matchKnown = (name) => KNOWN_SERVICES.find(k => k.re.test(strip(name))) || null

const targetKey = (check, target) => `${check}:${String(target || '').toLowerCase()}`

// 由上报的 _disc 生成“发现”列表；已在档案里或已忽略的不再出现
export function buildDiscovered(disc, profile) {
  if (!disc) return { known: [], unknown: [], ports: [], at: 0, hasDocker: false }
  const inProfile = new Set((profile?.services || []).map(s => targetKey(s.check, s.target)))
  const ignored = new Set((profile?.ignored || []).map(x => String(x).toLowerCase()))
  const usedIds = new Set((profile?.services || []).map(s => matchKnown(s.target)?.id).filter(Boolean))
  const known = []
  const unknown = []
  const seenIds = new Set()
  const units = Array.isArray(disc.units) ? disc.units : []
  for (const [unit, description] of units) {
    const short = strip(unit)
    if (inProfile.has(targetKey('systemd', short)) || inProfile.has(targetKey('systemd', unit))) continue
    if (ignored.has(short.toLowerCase())) continue
    const k = matchKnown(short)
    if (k) {
      if (seenIds.has(k.id) || usedIds.has(k.id)) continue
      seenIds.add(k.id)
      known.push({ ...k, check: 'systemd', target: short, raw: unit })
    } else if (!NOISE.some(re => re.test(short))) {
      unknown.push({ name: short, icon: '🧩', desc: String(description || '').slice(0, 120), check: 'systemd', target: short, raw: unit })
    }
  }
  const procs = Array.isArray(disc.procs) ? disc.procs : []
  for (const proc of procs) {
    if (inProfile.has(targetKey('process', proc))) continue
    if (ignored.has(String(proc).toLowerCase())) continue
    const k = matchKnown(proc)
    if (k) {
      if (seenIds.has(k.id) || usedIds.has(k.id)) continue
      seenIds.add(k.id)
      known.push({ ...k, check: 'process', target: proc, raw: proc })
    } else if (!units.length && !PROC_NOISE.test(proc) && !/[\/:]/.test(proc)) {
      unknown.push({ name: proc, icon: '🧩', desc: '进程', check: 'process', target: proc, raw: proc })
    }
  }
  // Docker 容器：按容器名或镜像名（去掉仓库前缀和标签）对照；没认出的也列出来
  const containers = Array.isArray(disc.containers) ? disc.containers : []
  for (const [cname, image, state] of containers) {
    if (inProfile.has(targetKey('docker', cname))) continue
    if (ignored.has(String(cname).toLowerCase())) continue
    const base = String(image || '').split('@')[0].split('/').pop().split(':')[0]
    const k = matchKnown(cname) || matchKnown(base)
    const stateText = state && state !== 'running' ? `（${state}）` : ''
    if (k && !seenIds.has(k.id) && !usedIds.has(k.id)) {
      seenIds.add(k.id)
      known.push({ ...k, desc: k.desc || `Docker · ${base}`, check: 'docker', target: cname, raw: `🐳 ${cname}${stateText}` })
    } else {
      unknown.push({ name: cname, icon: '🐳', desc: `Docker · ${image}${stateText}`, check: 'docker', target: cname, raw: cname })
    }
  }
  const ports = (Array.isArray(disc.ports) ? disc.ports : []).filter(p => Number(p) > 0).sort((a, b) => a - b)
  return { known, unknown, ports, at: Number(disc.at) || 0, hasDocker: Array.isArray(disc.containers) && disc.containers.length > 0, dockerSeen: Array.isArray(disc.procs) && disc.procs.some(p => /^(dockerd|containerd-shim.*)$/.test(p)) }
}

// 从自动发现结果里推这个服务的访问网址，返回 { url, note }，推不出来返回 null
// 端口来源：端口检查的目标；Docker 容器的宿主机映射端口；systemd 服务名 / 进程名对应的监听端口
// 网址优先级：反代域名 → Tailscale 内网 IP → 公网 IP → 只监听本机时给 localhost（需隧道）
const isLoop = (b) => /^(127\.|::1$|localhost$)/.test(String(b || ''))
const isAny = (b) => ['0.0.0.0', '::', '*', ''].includes(String(b || ''))
const NOISE_PORTS = new Set(['22', '53', '25', '111', '631'])

// 多端口服务的网页后台端口（API 口不算）
const WEB_PORT_HINTS = [
  [/magpie/i, '8000'],
]

// opts: { serverIp, ts }，ts=用户电脑能连 Tailscale
export function serviceUrl(svc, disc, opts = {}) {
  if (!svc || !disc) return null
  const o = typeof opts === 'string' ? { serverIp: opts } : (opts || {})
  const sites = Array.isArray(disc.sites) ? disc.sites : []
  const listen = Array.isArray(disc.listen) ? disc.listen : []
  const target = String(svc.target || '').toLowerCase()
  let cands = [] // [bind, port, score]
  if (svc.check === 'port' && target) {
    const hits = listen.filter(l => l[1] === target)
    cands = hits.length ? hits.map(l => [l[0], l[1], 0]) : [['0.0.0.0', target, 0]]
  } else if (svc.check === 'docker' && Array.isArray(disc.containers)) {
    const c = disc.containers.find(x => String(x[0]).toLowerCase() === target)
    if (c && Array.isArray(c[3])) cands = c[3].map(x => { const [b, p] = String(x).includes('|') ? String(x).split('|') : ['0.0.0.0', String(x)]; return [b, p, 1] })
  } else if ((svc.check === 'systemd' || svc.check === 'process') && target) {
    const t = target.replace(/\.service$/, '')
    for (const [b, p, proc, unit] of listen) {
      const pr = String(proc || '').toLowerCase(), un = String(unit || '').toLowerCase()
      if (svc.check === 'systemd' && un === t) cands.push([b, p, pr && (t.includes(pr) || pr.includes(t)) ? 1 : 2])
      else if (pr && (pr === t || (t.length >= 3 && (pr.includes(t) || t.includes(pr))))) cands.push([b, p, 1])
    }
  }
  // 手动指定的访问端口优先；其次已知的网页后台端口
  const want = String(svc.port || '') || (WEB_PORT_HINTS.find(([re]) => re.test(target) || re.test(String(svc.name || ''))) || [])[1] || ''
  if (svc.port && !cands.some(c => c[1] === want)) {
    const hits = listen.filter(l => l[1] === want)
    cands.push(...(hits.length ? hits.map(l => [l[0], l[1], 0]) : [['127.0.0.1', want, 0]]))
  }
  cands = cands.filter(c => c[1] && !NOISE_PORTS.has(String(c[1])))
  for (const c of cands) if (want && c[1] === want) c[2] = 0
  if (!cands.length) return null
  // 用户电脑连不上 Tailscale 时，只监听 Tailscale IP 的端口和只听本机的一样，都要走隧穿
  const tsOnly = (b) => /^100\./.test(String(b || ''))
  const needTunnel = (b) => isLoop(b) || (!o.ts && tsOnly(b))
  const byPort = new Map()
  for (const c of cands) {
    const old = byPort.get(c[1])
    if (!old || (needTunnel(old[0]) && !needTunnel(c[0])) || c[2] < old[2]) byPort.set(c[1], c)
  }
  const list = [...byPort.values()].sort((a, b) => a[2] - b[2] || Number(a[1]) - Number(b[1]))
  // 有反代域名的端口最优先（手动指定的端口有域名时先用它）
  const withSite = list.map(c => [c, sites.find(s => String(s[1]) === String(c[1]))]).filter(x => x[1])
  if (withSite.length && !(svc.port && !withSite.some(x => x[0][1] === svc.port))) {
    const [c, hit] = withSite.find(x => x[0][1] === want) || withSite[0]
    return { url: `https://${String(hit[0]).replace(/^\*\./, '')}`, note: '自动识别 · 反代域名', port: c[1] }
  }
  const [b, p] = list[0]
  if (isLoop(b)) return { url: `http://localhost:${p}`, note: '只监听本机，先在电脑上开隧穿', localPort: p, remote: 'localhost', port: p }
  if (tsOnly(b)) {
    if (o.ts) return { url: `http://${b}:${p}`, note: '自动识别 · Tailscale 内网', port: p }
    return { url: `http://localhost:${p}`, note: '只监听 Tailscale 内网，先在电脑上开隧穿', localPort: p, remote: b, port: p }
  }
  if (isAny(b) && disc.tsip && o.ts) return { url: `http://${disc.tsip}:${p}`, note: '自动识别 · Tailscale 内网', port: p }
  const host = isAny(b) ? o.serverIp : b
  if (!host) return null
  // 直连端口可能被防火墙挡，也给一条隧穿命令备用
  return { url: `http://${host.includes(':') ? `[${host}]` : host}:${p}`, note: '直连端口（打不开就用下面的隧穿）', localPort: p, remote: 'localhost', port: p }
}

export function siteUrlFor(svc, disc, opts) {
  const r = serviceUrl(svc, disc, opts)
  return r ? r.url : ''
}
