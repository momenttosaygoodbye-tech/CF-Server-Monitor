// 二开：自动发现对照表 —— 把 systemd 服务名 / 进程名翻译成正式名称
// re 同时匹配 systemd 服务名（去掉 .service）和进程名；先匹配到的规则生效
export const KNOWN_SERVICES = [
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
  { id: 'hermes', re: /^hermes(-gateway|-agent)?$/i, name: 'Hermes Agent 网关', icon: '🤖', desc: '' },
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
  /^lxcfs$/, /^iptables/, /^netfilter/, /^ufw$/, /^firewalld$/, /^haveged$/, /^rngd$/, /^auditd$/, /^tuned$/, /^kdump/,
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
  if (!disc) return { known: [], unknown: [], ports: [], at: 0 }
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
  const ports = (Array.isArray(disc.ports) ? disc.ports : []).filter(p => Number(p) > 0).sort((a, b) => a - b)
  return { known, unknown, ports, at: Number(disc.at) || 0 }
}
