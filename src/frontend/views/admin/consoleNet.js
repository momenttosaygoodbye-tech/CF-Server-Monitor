// 二开：监控控制台共用的三网延迟/丢包判断
import { PING } from '../../utils/constants.js'

export const NET_DEFS = [
  { key: 'ct', ping: 'ping_ct', loss: 'loss_ct', nameKey: 'custom_ct_name', fallback: '电信' },
  { key: 'cu', ping: 'ping_cu', loss: 'loss_cu', nameKey: 'custom_cu_name', fallback: '联通' },
  { key: 'cm', ping: 'ping_cm', loss: 'loss_cm', nameKey: 'custom_cm_name', fallback: '移动' }
]

const isDisabled = (v) => v === false || v === 'false'
const toNum = (v) => {
  if (v === null || v === undefined || v === '' || isDisabled(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export const pingOk = (v) => { const n = toNum(v); return n !== null && n > 0 }

export const pingColor = (v) => {
  if (!pingOk(v)) return 'var(--accent-red)'
  const n = Number(v)
  if (n < PING.GOOD_THRESHOLD) return 'var(--accent-green)'
  if (n < PING.WARNING_THRESHOLD) return 'var(--accent-blue)'
  if (n < PING.CRITICAL_THRESHOLD) return 'var(--accent-yellow)'
  return 'var(--accent-red)'
}

export const lossColor = (v) => {
  const n = toNum(v)
  if (n === null) return 'var(--text-secondary)'
  if (n <= 0) return 'var(--accent-green)'
  if (n < 5) return 'var(--accent-blue)'
  if (n < 20) return 'var(--accent-yellow)'
  return 'var(--accent-red)'
}

export const formatPing = (v) => (pingOk(v) ? `${Math.round(Number(v))} ms` : '超时')
export const formatLoss = (v) => { const n = toNum(v); return n === null ? '-' : `${Number(n.toFixed(1))}%` }

// 读取一台服务器的三网数据；后台把某一路设为关闭时跳过
export function getNets(server, config = {}) {
  return NET_DEFS
    .filter(d => !(isDisabled(server?.[d.ping]) && isDisabled(server?.[d.loss])))
    .map(d => ({
      key: d.key,
      name: config?.[d.nameKey] || d.fallback,
      ping: server?.[d.ping],
      loss: server?.[d.loss],
      pingOk: pingOk(server?.[d.ping]),
      lossNum: toNum(server?.[d.loss])
    }))
}

// “SSH 进不去”时的一句话判断。探针三网是从服务器往国内三网测的，
// IP 被墙时双向都不通，所以“探针在线 + 三网全不通”基本可判定为被墙。
export function diagnose(server, online, config = {}) {
  if (!online) {
    return { level: 'bad', title: '探针离线', text: '机器宕机、重启中，或到 Cloudflare 的出口断了。先去云厂商控制台看实例状态。' }
  }
  const nets = getNets(server, config)
  const hasData = nets.some(n => n.pingOk || n.lossNum !== null)
  if (!nets.length || !hasData) {
    return { level: 'none', title: '无三网数据', text: '后台没开三网探测，或还没采到数据。' }
  }
  const dead = nets.filter(n => !n.pingOk || (n.lossNum !== null && n.lossNum >= 80))
  if (dead.length === nets.length) {
    return { level: 'bad', title: '疑似被墙', text: '探针在线但三网全不通：大概率 IP 被墙，国内直连 SSH 会断。可换 IP，或走 CF 隧道 / 中转。' }
  }
  if (dead.length) {
    return { level: 'warn', title: `${dead.map(n => n.name).join('、')}不通`, text: '其他线路正常：多半是这家运营商线路阻断或绕路，换个网络（如手机热点）试试。' }
  }
  const worst = nets.reduce((a, b) => ((b.lossNum || 0) > (a.lossNum || 0) ? b : a), nets[0])
  const worstLoss = worst.lossNum || 0
  if (worstLoss >= 20) {
    return { level: 'warn', title: `${worst.name}丢包 ${formatLoss(worstLoss)}`, text: 'SSH 卡顿或断联多半是丢包，不是被墙。等线路恢复，或换别的运营商网络。' }
  }
  if (worstLoss >= 5) {
    return { level: 'info', title: `轻微丢包（最高 ${formatLoss(worstLoss)}）`, text: 'SSH 偶尔卡一下正常，一般不至于断开。' }
  }
  return { level: 'ok', title: '三网正常', text: 'SSH 还进不去就不是网络问题：查 sshd 服务、防火墙 / 安全组、端口和密钥。' }
}
