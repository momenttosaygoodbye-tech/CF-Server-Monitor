<template>
  <div id="tab-console" class="tab-content" :class="{ active: activeTab === 'console' }">
    <div v-if="activeTab === 'console'" class="ov">
      <div class="ov-summary">
        <div class="ov-stat"><b>{{ servers.length }}</b><span>服务器</span></div>
        <div class="ov-stat"><b class="c-ok">{{ onlineCount }}</b><span>探针在线</span></div>
        <div class="ov-stat"><b :class="netIssueCount ? 'c-bad' : 'c-ok'">{{ netIssueCount }}</b><span>网络异常</span></div>
        <div class="ov-stat"><b :class="badServiceCount ? 'c-bad' : 'c-ok'">{{ badServiceCount }}</b><span>服务异常</span></div>
        <div class="ov-tools">
          <span class="ov-time">{{ loading ? '刷新中…' : `更新于 ${updatedText}` }}</span>
          <button class="btn" :disabled="loading" @click="load(true)">↻ 刷新</button>
        </div>
      </div>
      <div v-if="error" class="ov-error">{{ error }}</div>

      <div class="ov-grid">
        <a v-for="s in servers" :key="s.id" class="ov-card" :class="'lv-' + s.diag.level" :href="consoleHref(s)">
          <div class="ov-head">
            <img v-if="s.region && s.region !== 'xx'" :src="getPublicAssetUrl('flags/' + getFlagRegionCode(s.region) + '.svg')" class="ov-flag" :alt="s.region">
            <span class="ov-name">{{ s.name }}</span>
            <span class="ov-online" :class="s.online ? 'on' : 'off'"><i></i>{{ s.online ? '在线' : '离线' }}</span>
          </div>
          <div class="ov-ip">{{ s.ip || '—' }}<template v-if="s.server_group && s.server_group !== 'Default'"> · {{ s.server_group }}</template></div>

          <div class="ov-res">
            <div v-for="r in s.res" :key="r.label" class="ov-res-item">
              <div class="ov-res-top"><span>{{ r.label }}</span><span>{{ r.pct.toFixed(0) }}%</span></div>
              <div class="ov-bar"><div :style="{ width: Math.max(2, r.pct) + '%', background: r.pct > 90 ? 'var(--accent-red)' : r.pct > 75 ? 'var(--accent-yellow)' : '' }"></div></div>
            </div>
          </div>

          <div class="ov-nets">
            <div v-for="n in s.nets" :key="n.key" class="ov-net">
              <span class="ov-net-name">{{ n.name }}</span>
              <template v-if="s.online">
                <span class="ov-net-ping" :style="{ color: pingColor(n.ping) }">{{ formatPing(n.ping) }}</span>
                <span class="ov-net-loss" :style="{ color: lossColor(n.loss) }">丢包 {{ formatLoss(n.loss) }}</span>
              </template>
              <template v-else>
                <span class="ov-net-ping c-dim">—</span>
                <span class="ov-net-loss c-dim">无数据</span>
              </template>
            </div>
            <div v-if="!s.nets.length" class="ov-net muted">未开启三网探测</div>
          </div>

          <div class="ov-diag">
            <b>{{ s.diag.title }}</b>
            <span>{{ s.diag.text }}</span>
          </div>

          <div class="ov-svc">
            <template v-if="s.svc.total">
              <span class="ov-svc-count" :class="s.svc.bad.length ? 'c-bad' : s.svc.unknown ? 'c-dim' : 'c-ok'">
                服务 {{ s.svc.ok }}/{{ s.svc.total }} 运行
              </span>
              <span v-for="b in s.svc.bad" :key="b" class="ov-svc-bad">{{ b }}</span>
              <span v-if="s.svc.stale" class="ov-svc-stale">状态已过期</span>
            </template>
            <span v-else class="c-dim">{{ s.svc.hasProfile ? '只记录了网址/命令' : '还没建档案' }}</span>
            <span class="ov-open">控制台 →</span>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted, inject } from 'vue'
import { http } from '../../../utils/http'
import { getFlagRegionCode, isServerOnline } from '../../../utils/api.js'
import { getPublicAssetUrl } from '../../../utils/config.js'
import { getNets, diagnose, pingColor, lossColor, formatPing, formatLoss } from '../consoleNet.js'

const props = defineProps({
  activeTab: { type: String, default: '' },
  selectedApiIndex: { type: Number, default: 0 }
})

const appConfig = inject('appConfig', {})
const rawServers = ref([])
const overview = ref({})
const loading = ref(false)
const error = ref('')
const updatedAt = ref(0)
const now = ref(Date.now())
let timer = null

const cleanIp = (v) => { const x = String(v || '').trim(); return x && x !== '0' && x !== '1' ? x : '' }
const pct = (a, b) => (parseFloat(b) > 0 ? Math.min(100, (parseFloat(a) || 0) / parseFloat(b) * 100) : 0)

const servers = computed(() => rawServers.value.map(s => {
  const online = s.is_online === true || isServerOnline(s, now.value)
  const ov = overview.value[s.id]
  const services = (ov?.services || []).filter(x => x.check && x.check !== 'none')
  const stale = !!ov && services.length > 0 && (!ov.reported_at || (now.value / 1000 - ov.reported_at) > 300)
  const bad = services.filter(x => x.state && x.state !== 'active').map(x => x.name)
  return {
    ...s,
    online,
    ip: cleanIp(s.ip_v4) || cleanIp(s.ip_v6),
    res: [
      { label: 'CPU', pct: Math.min(100, parseFloat(s.cpu) || 0) },
      { label: '内存', pct: pct(s.ram_used, s.ram_total) },
      { label: '磁盘', pct: pct(s.disk_used, s.disk_total) }
    ],
    nets: getNets(s, appConfig),
    diag: diagnose(s, online, appConfig),
    svc: {
      hasProfile: !!ov,
      total: services.length,
      ok: services.filter(x => x.state === 'active').length,
      unknown: services.some(x => !x.state),
      bad: stale ? [] : bad,
      stale
    }
  }
}))

const onlineCount = computed(() => servers.value.filter(s => s.online).length)
const netIssueCount = computed(() => servers.value.filter(s => ['bad', 'warn'].includes(s.diag.level)).length)
const badServiceCount = computed(() => servers.value.reduce((n, s) => n + s.svc.bad.length, 0))
const updatedText = computed(() => {
  if (!updatedAt.value) return '-'
  const sec = Math.max(0, Math.floor((now.value - updatedAt.value) / 1000))
  return sec < 60 ? `${sec} 秒前` : `${Math.floor(sec / 60)} 分钟前`
})

const consoleHref = (s) => `/admin#/admin/console/${encodeURIComponent(s.id)}${props.selectedApiIndex ? `?apiIndex=${props.selectedApiIndex}` : ''}`

const load = async (refresh = false) => {
  loading.value = true
  error.value = ''
  try {
    const [list, ov] = await Promise.all([
      http.postByIndex('/admin/api', refresh ? { action: 'list', refresh: true } : { action: 'list' }, props.selectedApiIndex),
      http.postByIndex('/console/api', { action: 'overview' }, props.selectedApiIndex, { autoRedirect: false })
    ])
    if (list?.error) error.value = `读取服务器失败：${list.error}`
    else rawServers.value = list?.data?.servers || []
    if (!ov?.error) overview.value = ov?.data?.servers || {}
    updatedAt.value = Date.now()
  } catch (e) {
    error.value = `加载失败：${e.message}`
  } finally {
    loading.value = false
  }
}

const stop = () => { clearInterval(timer); timer = null }
watch(() => props.activeTab, (tab) => {
  stop()
  if (tab !== 'console') return
  load()
  timer = setInterval(() => {
    now.value = Date.now()
    if (document.visibilityState === 'visible' && Date.now() - updatedAt.value > 30000) load()
  }, 5000)
}, { immediate: true })
watch(() => props.selectedApiIndex, () => { if (props.activeTab === 'console') load() })
onUnmounted(stop)
</script>

<style scoped>
.ov-summary { display: flex; flex-wrap: wrap; gap: 12px; align-items: stretch; margin: 6px 0 16px; }
.ov-stat { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 10px 18px; display: flex; flex-direction: column; min-width: 96px; }
.ov-stat b { font-size: 16px; color: var(--text-primary); }
.ov-stat span { font-size: 11px; color: var(--text-secondary); }
.ov-tools { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.ov-time { font-size: 11px; color: var(--text-secondary); }
.ov-error { border: 1px solid var(--accent-red); color: var(--accent-red); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; }
.c-ok { color: var(--accent-green) !important; }
.c-bad { color: var(--accent-red) !important; }
.c-dim { color: var(--text-secondary); }

.ov-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ov-card { display: flex; flex-direction: column; gap: 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-left: 3px solid var(--border-active); border-radius: 12px; padding: 14px 16px; text-decoration: none; color: var(--text-primary); transition: border-color .2s, transform .2s; }
.ov-card:hover { border-color: var(--accent-green); transform: translateY(-1px); }
.ov-card.lv-ok { border-left-color: var(--accent-green); }
.ov-card.lv-info { border-left-color: var(--accent-blue); }
.ov-card.lv-warn { border-left-color: var(--accent-yellow); }
.ov-card.lv-bad { border-left-color: var(--accent-red); }
.ov-head { display: flex; align-items: center; gap: 8px; }
.ov-flag { width: 22px; height: 15px; border-radius: 2px; }
.ov-name { font-weight: 700; font-size: 12px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-online { font-size: 11px; display: inline-flex; align-items: center; gap: 5px; }
.ov-online i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.ov-online.on { color: var(--accent-green); }
.ov-online.off { color: var(--accent-red); }
.ov-ip { font-size: 11px; color: var(--text-secondary); font-family: ui-monospace, Menlo, Consolas, monospace; margin-top: -6px; }
.ov-res { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.ov-res-top { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); margin-bottom: 4px; }
.ov-bar { height: 5px; background: var(--bg-hover); border-radius: 99px; overflow: hidden; }
.ov-bar div { height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-blue)); border-radius: 99px; }
.ov-nets { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--border-color); padding-top: 8px; }
.ov-net { display: grid; grid-template-columns: 48px 1fr auto; font-size: 12px; align-items: baseline; }
.ov-net.muted { display: block; color: var(--text-secondary); font-size: 11px; }
.ov-net-name { color: var(--text-secondary); }
.ov-net-ping { font-weight: 700; font-family: ui-monospace, Menlo, Consolas, monospace; }
.ov-net-loss { font-size: 11px; font-family: ui-monospace, Menlo, Consolas, monospace; }
.ov-diag { font-size: 11px; line-height: 1.5; background: var(--bg-secondary); border-radius: 8px; padding: 7px 10px; color: var(--text-secondary); }
.ov-diag b { color: var(--text-primary); margin-right: 6px; }
.lv-ok .ov-diag b { color: var(--accent-green); }
.lv-info .ov-diag b { color: var(--accent-blue); }
.lv-warn .ov-diag b { color: var(--accent-yellow); }
.lv-bad .ov-diag b { color: var(--accent-red); }
.ov-svc { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 11px; }
.ov-svc-count { font-weight: 600; }
.ov-svc-bad { color: var(--accent-red); border: 1px solid var(--accent-red); border-radius: 99px; padding: 0 8px; }
.ov-svc-stale { color: var(--accent-yellow); }
.ov-open { margin-left: auto; color: var(--text-secondary); }
.ov-card:hover .ov-open { color: var(--accent-green); }
@media (max-width: 1100px) { .ov-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 640px) { .ov-grid { grid-template-columns: 1fr; } .ov-tools { margin-left: 0; } }
</style>
