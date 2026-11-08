<template>
  <div class="container console-container">
    <TerminalHeader title="监控控制台" />

    <div v-if="!loggedIn" class="console-empty">
      <p>需要先登录管理员。</p>
      <a class="btn" href="/admin#/admin">去登录</a>
    </div>

    <template v-else>
      <!-- 头部 -->
      <div class="console-head">
        <div class="console-head-left">
          <a class="console-back" :href="adminHref">← 管理面板</a>
          <h1 class="console-title">
            <img v-if="server.region && server.region !== 'xx'" :src="getPublicAssetUrl('flags/' + getFlagRegionCode(server.region) + '.svg')" class="console-flag" :alt="server.region">
            {{ server.name || '加载中…' }}
          </h1>
          <div class="console-chips">
            <span v-if="server.server_group" class="chip">📂 {{ server.server_group }}</span>
            <span v-if="server.cpu_info" class="chip">💻 {{ shortCpu }}<template v-if="server.cpu_cores"> · {{ server.cpu_cores }}C</template><template v-if="server.ram_total"> {{ ramGb }}G</template></span>
            <span v-if="ipText" class="chip chip-copy" title="复制 IP" @click="copy(ipText, 'ip')">🌐 {{ ipText }} <em>{{ copied === 'ip' ? '已复制' : '' }}</em></span>
            <span v-if="server.boot_time" class="chip">⏱ 运行 {{ uptimeText }}</span>
          </div>
        </div>
        <div class="console-head-right">
          <span class="live-pill" :class="online ? 'on' : 'off'">
            <i></i>{{ online ? '探针在线' : '探针离线' }} · {{ lastSeenText }}
          </span>
          <div class="console-actions">
            <button class="btn" :disabled="loading" @click="load">↻ 刷新</button>
            <button v-if="!editing" class="btn btn-green" @click="startEdit">✎ 编辑档案</button>
            <template v-else>
              <button class="btn btn-green" :disabled="saving" @click="save">{{ saving ? '保存中…' : '💾 保存' }}</button>
              <button class="btn" :disabled="saving" @click="cancelEdit">取消</button>
            </template>
          </div>
        </div>
      </div>

      <div v-if="error" class="console-error">{{ error }}</div>

      <!-- 资源卡片 -->
      <div class="res-grid">
        <div class="res-card">
          <div class="res-top"><span>CPU 利用率</span><span class="res-pct">{{ cpuPct.toFixed(1) }}%</span></div>
          <div class="res-big">{{ cpuPct.toFixed(1) }} <small>%</small></div>
          <div class="bar"><div class="bar-fill" :style="barStyle(cpuPct)"></div></div>
          <div class="res-foot"><span>负载 {{ loadText }}</span><span>{{ server.processes ? server.processes + ' 进程' : '' }}</span></div>
        </div>
        <div class="res-card">
          <div class="res-top"><span>物理内存 (RAM)</span><span class="res-pct">{{ ramPct.toFixed(1) }}%</span></div>
          <div class="res-big">{{ num(server.ram_used) }} <small>/{{ num(server.ram_total) }} MB</small></div>
          <div class="bar"><div class="bar-fill" :style="barStyle(ramPct)"></div></div>
          <div class="res-foot"><span>剩余可用 {{ Math.max(0, num(server.ram_total) - num(server.ram_used)) }} MB</span></div>
        </div>
        <div class="res-card">
          <div class="res-top"><span>虚拟内存 (SWAP)</span><span class="res-pct">{{ swapPct.toFixed(1) }}%</span></div>
          <div class="res-big">{{ num(server.swap_used) }} <small>/{{ num(server.swap_total) }} MB</small></div>
          <div class="bar"><div class="bar-fill purple" :style="barStyle(swapPct)"></div></div>
          <div class="res-foot"><span>{{ num(server.swap_total) ? '已配置 ' + num(server.swap_total) + ' MB' : '未配置 SWAP' }}</span></div>
        </div>
        <div class="res-card">
          <div class="res-top"><span>系统磁盘</span><span class="res-pct">{{ diskPct.toFixed(1) }}%</span></div>
          <div class="res-big">{{ gb(server.disk_used) }} <small>/{{ gb(server.disk_total) }} GB</small></div>
          <div class="bar"><div class="bar-fill" :style="barStyle(diskPct)"></div></div>
          <div class="res-foot"><span>剩余 {{ (Math.max(0, num(server.disk_total) - num(server.disk_used)) / 1024).toFixed(1) }} GB</span></div>
        </div>
      </div>

      <!-- 信息块：查看模式 -->
      <template v-if="!editing">
        <div v-if="!profile.blocks.length && !profile.services.length" class="console-empty">
          <p>这台机器还没有档案。点「编辑档案」记下它跑了哪些服务、后台网址和隧穿命令。</p>
        </div>

        <div v-for="(block, bi) in profile.blocks" :key="'b' + bi" class="info-block">
          <div class="info-title">
            <span>{{ block.icon || '📌' }} {{ block.title || '未命名' }}</span>
            <span v-if="linkedSvc(block)" class="badge" :class="badge(linkedSvc(block)).cls" :title="'关联服务：' + linkedSvc(block).name"><i></i>{{ badge(linkedSvc(block)).text }}</span>
          </div>
          <template v-for="(row, ri) in block.rows" :key="'r' + ri">
          <div v-if="row.value" class="info-row">
            <span class="info-label">{{ row.label }}：</span>
            <span class="info-value" :class="'kind-' + row.kind">
              <a v-if="row.kind === 'link'" :href="safeHref(row.value)" target="_blank" rel="noopener noreferrer">{{ row.value }} ↗</a>
              <code v-else-if="row.kind === 'copy'">{{ row.value }}</code>
              <span v-else>{{ row.value }}</span>
            </span>
            <button v-if="row.kind !== 'text'" class="mini-btn" @click="copy(row.value, bi + '-' + ri)">{{ copied === bi + '-' + ri ? '✓ 已复制' : '复制' }}</button>
            <span v-if="row.note" class="info-note">{{ row.note }}</span>
          </div>
          </template>
          <div v-if="autoUrl(block)" class="info-row">
            <span class="info-label">访问地址：</span>
            <span class="info-value kind-link"><a :href="safeHref(autoUrl(block).url)" target="_blank" rel="noopener noreferrer">{{ autoUrl(block).url }} ↗</a></span>
            <button class="mini-btn" @click="copy(autoUrl(block).url, bi + '-auto')">{{ copied === bi + '-auto' ? '✓ 已复制' : '复制' }}</button>
            <span class="info-note">{{ autoUrl(block).note }}</span>
          </div>
          <div v-if="autoUrl(block) && autoUrl(block).localPort" class="info-row">
            <span class="info-label">隧穿命令：</span>
            <span class="info-value kind-copy"><code>{{ tunnelCmd(autoUrl(block)) }}</code></span>
            <button class="mini-btn" @click="copy(tunnelCmd(autoUrl(block)), bi + '-tun')">{{ copied === bi + '-tun' ? '✓ 已复制' : '复制' }}</button>
            <span class="info-note">{{ tunnelHint }}</span>
          </div>
        </div>

        <!-- 服务状态 -->
        <template v-if="profile.services.length">
          <div class="svc-head">
            <h2>核心云端服务运行状态</h2>
            <span class="svc-meta">{{ reportedText }}</span>
          </div>
          <div class="svc-grid">
            <div v-for="svc in profile.services" :key="svc.key" class="svc-card">
              <div class="svc-icon">{{ svc.icon || '🧩' }}</div>
              <div class="svc-body">
                <div class="svc-name">{{ svc.name || '未命名服务' }}</div>
                <div class="svc-desc" :title="svc.desc">{{ svc.desc }}</div>
              </div>
              <span class="badge" :class="badge(svc).cls"><i></i>{{ badge(svc).text }}</span>
            </div>
          </div>
        </template>

        <!-- 自动发现 -->
        <div v-if="discovered.at" class="disc-box">
          <div class="disc-head">
            <div class="info-title">🔎 自动发现</div>
            <span class="svc-meta">{{ discText }}</span>
          </div>
          <template v-if="discovered.known.length">
            <div class="disc-sub">
              认出 {{ discovered.known.length }} 个服务，点「加入」就会进档案并开始检查
              <button class="mini-btn" :disabled="discSaving" @click="addDiscovered(discovered.known)">全部加入</button>
            </div>
            <div class="disc-list">
              <div v-for="item in discovered.known" :key="item.check + item.target" class="disc-item">
                <span class="disc-icon">{{ item.icon }}</span>
                <span class="disc-name">{{ item.name }}</span>
                <code class="disc-raw">{{ item.raw }}</code>
                <button class="mini-btn" :disabled="discSaving" @click="addDiscovered([item])">加入</button>
                <button class="mini-btn ghost" :disabled="discSaving" @click="ignoreDiscovered(item)">忽略</button>
              </div>
            </div>
          </template>
          <div v-else class="disc-sub">没有新的已知服务可加。</div>
          <details v-if="discovered.unknown.length" class="disc-more">
            <summary>其他在运行、没认出来的服务（{{ discovered.unknown.length }}）——加入后在「编辑档案」里改个名字就行</summary>
            <div class="disc-list">
              <div v-for="item in discovered.unknown" :key="item.check + item.target" class="disc-item">
                <span class="disc-icon">{{ item.icon }}</span>
                <code class="disc-name">{{ item.name }}</code>
                <span class="disc-raw">{{ item.desc }}</span>
                <button class="mini-btn" :disabled="discSaving" @click="addDiscovered([item])">加入</button>
                <button class="mini-btn ghost" :disabled="discSaving" @click="ignoreDiscovered(item)">忽略</button>
              </div>
            </div>
          </details>
          <div v-if="status._disc" class="disc-sub">网址识别：{{ (status._disc.listen || []).length ? `读到 ${status._disc.listen.length} 条监听端口` : '还没读到端口对应关系' }}，{{ (status._disc.sites || []).length }} 个反代域名{{ status._disc.tsip ? '，有 Tailscale' : '' }}{{ (status._disc.v || 1) < 7 ? '。本机脚本是旧版，重跑一次安装命令才能识别网址和反代域名' : '' }}</div>
          <div v-if="discovered.dockerSeen && !discovered.hasDocker" class="disc-sub">🐳 这台装了 Docker，但还读不到容器列表：在本机重新执行一次下面的安装命令即可（只需一次）。</div>
          <div v-if="discovered.ports.length" class="disc-ports">
            <span>本机监听端口：</span>
            <code v-for="port in discovered.ports" :key="port">{{ port }}</code>
          </div>
        </div>

        <!-- 状态脚本 -->
        <details class="agent-box">
          <summary>📡 状态上报脚本（让服务卡片显示运行中 / inactive）</summary>
          <p class="agent-tip">脚本只往外发数据，不开端口、不接收命令，每 60 秒用 <code>systemctl is-active</code> / <code>pgrep</code> / 监听端口 / Docker 容器状态 检查一次你在档案里填的服务；每 10 分钟列一次在跑的服务名、进程名和监听端口，用来做「自动发现」（不读配置、命令行参数或密码）。令牌只能写这台机器的状态。</p>
          <div class="agent-row">
            <span class="info-label">安装（有 systemd，root）：</span>
            <code class="agent-cmd">{{ installCmd }}</code>
            <button class="mini-btn" @click="copy(installCmd, 'install')">{{ copied === 'install' ? '✓ 已复制' : '复制' }}</button>
          </div>
          <div class="agent-row">
            <span class="info-label">无 systemd 的容器：</span>
            <code class="agent-cmd">{{ loopCmd }}</code>
            <button class="mini-btn" @click="copy(loopCmd, 'loop')">{{ copied === 'loop' ? '✓ 已复制' : '复制' }}</button>
          </div>
          <div class="agent-row">
            <span class="info-label">卸载：</span>
            <code class="agent-cmd">{{ uninstallCmd }}</code>
            <button class="mini-btn" @click="copy(uninstallCmd, 'uninstall')">{{ copied === 'uninstall' ? '✓ 已复制' : '复制' }}</button>
          </div>
        </details>
      </template>

      <!-- 编辑模式 -->
      <template v-else>
        <div class="edit-section">
          <div class="edit-section-head">
            <h2>隧穿设置</h2>
          </div>
          <p class="agent-tip">只监听本机的服务会自动生成 ssh 隧穿命令。这里填你电脑上的密钥路径和登录用户，设一次就行（留空的部分命令里会留 &lt;占位&gt;）。</p>
          <div class="edit-line">
            <input v-model="draft.tunnel.key" class="form-input w-value" placeholder="密钥路径，如 %USERPROFILE%\.ssh\dsh-tunnel">
            <input v-model="draft.tunnel.user" class="form-input w-label" placeholder="登录用户，如 ubuntu">
            <input v-model="draft.tunnel.host" class="form-input w-label" :placeholder="'主机，默认 ' + (ipText || 'IP')">
            <input v-model="draft.tunnel.port" class="form-input w-kind" placeholder="SSH 端口，默认 22">
          </div>
          <label class="agent-tip"><input v-model="draft.tunnel.ts" type="checkbox"> 我的电脑装了 Tailscale（勾上才会直接给 100.x 内网地址）</label>
        </div>

        <div class="edit-section">
          <div class="edit-section-head">
            <h2>信息块</h2>
            <div class="edit-actions">
              <select v-if="draft.services.length" class="form-select" value="" @change="addBlockFromSvc($event.target.value); $event.target.value = ''">
                <option value="">从核心服务新建…</option>
                <option v-for="svc in draft.services" :key="svc.key" :value="svc.key">{{ svc.icon }} {{ svc.name || svc.target || '未命名服务' }}</option>
              </select>
              <button class="btn" @click="addBlock">＋ 加一个信息块</button>
            </div>
          </div>
          <p class="agent-tip">比如「哪吒监控面板」：管理后台（网址）、公开监控（网址）、隧穿命令（复制）、服务端口（文本）。不要填密码。</p>
          <div v-for="(block, bi) in draft.blocks" :key="'eb' + bi" class="edit-block">
            <div class="edit-line">
              <select v-model="block.icon" class="form-select icon-select">
                <option v-for="ic in icons" :key="ic" :value="ic">{{ ic }}</option>
              </select>
              <input v-model="block.title" class="form-input w-title" placeholder="标题，如 哪吒监控面板 v1">
              <select v-model="block.svc" class="form-select w-kind" title="关联后，块标题旁会显示这个服务的运行状态" @change="onLinkSvc(block)">
                <option value="">不关联服务</option>
                <option v-for="svc in draft.services" :key="svc.key" :value="svc.key">关联：{{ svc.icon }} {{ svc.name || svc.target || '未命名服务' }}</option>
              </select>
              <button class="mini-btn" :disabled="bi === 0" @click="move(draft.blocks, bi, -1)">↑</button>
              <button class="mini-btn" :disabled="bi === draft.blocks.length - 1" @click="move(draft.blocks, bi, 1)">↓</button>
              <button class="mini-btn danger" @click="draft.blocks.splice(bi, 1)">删除块</button>
            </div>
            <div v-for="(row, ri) in block.rows" :key="'er' + ri" class="edit-line sub">
              <input v-model="row.label" class="form-input w-label" placeholder="名称，如 管理后台">
              <select v-model="row.kind" class="form-select w-kind">
                <option value="link">网址（可点开）</option>
                <option value="copy">命令/文本（可复制）</option>
                <option value="text">普通文字</option>
              </select>
              <input v-model="row.value" class="form-input w-value" :placeholder="row.kind === 'link' ? 'https://…' : 'ssh -N -L 8050:localhost:8050 …'">
              <input v-model="row.note" class="form-input w-note" placeholder="备注（可选）">
              <button class="mini-btn danger" @click="block.rows.splice(ri, 1)">✕</button>
            </div>
            <button class="mini-btn" @click="block.rows.push({ label: '', value: '', kind: 'copy', note: '' })">＋ 加一行</button>
          </div>
        </div>

        <div class="edit-section">
          <div class="edit-section-head">
            <h2>核心服务</h2>
            <button class="btn" @click="addService">＋ 加一个服务</button>
          </div>
          <p class="agent-tip">检查方式：systemd 填服务名（如 sing-box、nginx）；进程填进程关键字（如 xray）；端口填数字（如 8050）。选「不检查」就只显示不亮灯。</p>
          <div v-for="(svc, si) in draft.services" :key="svc.key || 'es' + si" class="edit-line svc-edit">
            <select v-model="svc.icon" class="form-select icon-select">
              <option v-for="ic in icons" :key="ic" :value="ic">{{ ic }}</option>
            </select>
            <input v-model="svc.name" class="form-input w-label" placeholder="服务名，如 Sing-box">
            <input v-model="svc.desc" class="form-input w-value" placeholder="说明，如 VLESS-Reality / Hysteria2">
            <select v-model="svc.check" class="form-select w-kind">
              <option value="systemd">systemd 服务</option>
              <option value="process">进程</option>
              <option value="port">监听端口</option>
              <option value="docker">Docker 容器</option>
              <option value="none">不检查</option>
            </select>
            <input v-model="svc.target" class="form-input w-note" :disabled="svc.check === 'none'" :placeholder="svc.check === 'port' ? '8050' : svc.check === 'process' ? 'xray' : svc.check === 'docker' ? '容器名，如 sillytavern' : 'sing-box'">
            <input v-model="svc.port" class="form-input w-port" placeholder="访问端口" title="服务有多个端口时，填网页后台的端口；留空自动选">
            <button class="mini-btn" :disabled="si === 0" @click="move(draft.services, si, -1)">↑</button>
            <button class="mini-btn" :disabled="si === draft.services.length - 1" @click="move(draft.services, si, 1)">↓</button>
            <button class="mini-btn danger" @click="draft.services.splice(si, 1)">✕</button>
          </div>
        </div>
      </template>
    </template>

    <Footer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import TerminalHeader from '../../components/TerminalHeader.vue'
import Footer from '../../components/Footer.vue'
import { http, isAdminLoggedIn } from '../../utils/http'
import { fetchServerDetail, getFlagRegionCode, isServerOnline } from '../../utils/api.js'
import { getPublicAssetUrl, getApiBases } from '../../utils/config.js'
import { copyTextToClipboard } from '../../utils/clipboard.js'
import { buildDiscovered, serviceUrl } from './consoleDiscover.js'


const DEFAULT_ICONS = ['🖥️', '📁', '📊', '🛡️', '🎯', '🚀', '🌐', '🔐', '🧰', '🐳', '📡', '🗄️', '🤖', '🎬', '🔧', '⚡', '📦', '🔗']

const route = useRoute()
const serverId = computed(() => String(route.params.id || ''))
const apiIndex = computed(() => Number(route.query.apiIndex || 0) || 0)
const loggedIn = ref(isAdminLoggedIn())

const server = ref({})
const profile = ref({ blocks: [], services: [] })
const status = ref({})
const reportedAt = ref(0)
const reportToken = ref('')
const icons = ref(DEFAULT_ICONS)
const loading = ref(false)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const draft = ref({ blocks: [], services: [] })
const copied = ref('')
const now = ref(Date.now())
let timer = null
let clock = null

const adminHref = computed(() => `/admin#/admin${apiIndex.value ? `?apiIndex=${apiIndex.value}` : ''}`)

const consoleApi = (body) => http.postByIndex('/console/api', body, apiIndex.value, { autoRedirect: false })

const load = async () => {
  if (!serverId.value) return
  loading.value = true
  error.value = ''
  try {
    const [detail, res] = await Promise.all([
      fetchServerDetail(encodeURIComponent(serverId.value), apiIndex.value),
      consoleApi({ action: 'get', id: serverId.value })
    ])
    if (detail) server.value = detail
    if (res?.status === 401) {
      loggedIn.value = false
      return
    }
    if (res?.error) {
      error.value = `读取档案失败：${res.error}`
    } else if (res?.data) {
      if (!editing.value) profile.value = normalizeProfile(res.data.profile)
      status.value = res.data.status || {}
      reportedAt.value = Number(res.data.reported_at) || 0
      reportToken.value = res.data.report_token || ''
      if (Array.isArray(res.data.icons) && res.data.icons.length) icons.value = res.data.icons
    }
  } catch (e) {
    error.value = `加载失败：${e.message}`
  } finally {
    loading.value = false
  }
}

const normalizeProfile = (p) => ({
  blocks: Array.isArray(p?.blocks) ? p.blocks.map(b => ({ ...b, rows: Array.isArray(b.rows) ? b.rows : [] })) : [],
  services: Array.isArray(p?.services) ? p.services : [],
  ignored: Array.isArray(p?.ignored) ? p.ignored : [],
  tunnel: { key: '', user: '', host: '', port: '', ts: false, ...(p?.tunnel || {}) }
})

// 隧穿命令：本服务器没设过就沿用上次在别的服务器设的密钥路径和用户
const TUN_KEY = 'cfsm-console-tunnel'
const tunnelDefaults = () => { try { return JSON.parse(localStorage.getItem(TUN_KEY) || '{}') } catch { return {} } }
const tunnelCfg = computed(() => {
  const t = profile.value.tunnel || {}
  const d = tunnelDefaults()
  return { key: t.key || d.key || '', user: t.user || d.user || '', host: t.host || ipText.value || '', port: t.port || '' }
})
const tunnelCmd = (r) => {
  const t = tunnelCfg.value
  const key = t.key ? `-i "${t.key}" ` : ''
  const sp = t.port && t.port !== '22' ? `-p ${t.port} ` : ''
  const port = r.localPort
  // 心跳：每 60 秒一次，连续 3 次没回应才断，防止闲置被掐
  return `ssh ${key}${sp}-o ServerAliveInterval=60 -o ServerAliveCountMax=3 -N -L ${port}:${r.remote || 'localhost'}:${port} ${t.user || '<用户>'}@${t.host || '<主机>'}`
}
const tunnelHint = computed(() => {
  const t = tunnelCfg.value
  if (!t.key || !t.user) return '在「编辑档案 → 隧穿设置」里填一次密钥路径和用户'
  return '在电脑上执行，保持窗口开着，然后打开上面的地址'
})

const startEdit = () => {
  draft.value = JSON.parse(JSON.stringify(profile.value))
  if (!draft.value.tunnel) draft.value.tunnel = { key: '', user: '', host: '', port: '', ts: false }
  const d = tunnelDefaults()
  if (!draft.value.tunnel.key && d.key) draft.value.tunnel.key = d.key
  if (!draft.value.tunnel.user && d.user) draft.value.tunnel.user = d.user
  for (const svc of draft.value.services) if (!/^[a-z0-9]{4,16}$/.test(svc.key || '')) svc.key = newKey()
  for (const b of draft.value.blocks) if (b.svc === undefined) b.svc = ''
  editing.value = true
}
const cancelEdit = () => { editing.value = false }

const save = async () => {
  saving.value = true
  error.value = ''
  try {
    const res = await consoleApi({ action: 'save', id: serverId.value, profile: draft.value })
    if (res?.error) {
      error.value = `保存失败：${res.error}`
      return
    }
    profile.value = normalizeProfile(res.data.profile)
    const t = profile.value.tunnel
    if (t.key || t.user) { try { localStorage.setItem(TUN_KEY, JSON.stringify({ key: t.key, user: t.user })) } catch {} }
    editing.value = false
  } finally {
    saving.value = false
  }
}

// 自动发现：加入档案 / 忽略，直接保存
const discSaving = ref(false)
const discovered = computed(() => buildDiscovered(status.value?._disc, profile.value))
const discText = computed(() => {
  const at = discovered.value.at
  if (!at) return ''
  const min = Math.max(0, Math.floor((now.value / 1000 - at) / 60))
  return `${min < 1 ? '刚刚' : min + ' 分钟前'}扫描 · 每 10 分钟一次`
})
const saveProfileDirect = async (next) => {
  discSaving.value = true
  error.value = ''
  try {
    const res = await consoleApi({ action: 'save', id: serverId.value, profile: next })
    if (res?.error) { error.value = `保存失败：${res.error}`; return }
    profile.value = normalizeProfile(res.data.profile)
  } finally {
    discSaving.value = false
  }
}
const addDiscovered = (items) => {
  const next = JSON.parse(JSON.stringify(profile.value))
  for (const it of items) next.services.push({ key: newKey(), name: it.name, icon: it.icon, desc: it.desc || '', check: it.check, target: it.target })
  return saveProfileDirect(next)
}
const ignoreDiscovered = (item) => {
  const next = JSON.parse(JSON.stringify(profile.value))
  next.ignored = [...(next.ignored || []), item.target]
  return saveProfileDirect(next)
}

const addBlock = () => draft.value.blocks.push({ title: '', icon: '📊', rows: [{ label: '管理后台', value: '', kind: 'link', note: '' }] })
const newKey = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')
const addService = () => draft.value.services.push({ key: newKey(), name: '', icon: '🚀', desc: '', check: 'systemd', target: '' })
const linkedSvc = (block) => block?.svc ? profile.value.services.find(s => s.key === block.svc) || null : null
// 关联服务的块里还没有填网址时，自动显示从反代配置认出来的网址
const autoUrl = (block) => {
  const svc = linkedSvc(block)
  if (!svc) return null
  if ((block.rows || []).some(r => r.kind === 'link' && r.value)) return null
  return serviceUrl(svc, status.value?._disc, { serverIp: ipText.value, ts: !!profile.value.tunnel?.ts })
}
const fillUrl = (block, svc) => {
  const r = serviceUrl(svc, status.value?._disc, { serverIp: ipText.value, ts: !!profile.value.tunnel?.ts })
  if (!r || !r.url.startsWith('https://')) return
  const url = r.url
  const row = (block.rows || []).find(r => r.kind === 'link' && !r.value)
  if (row) { row.value = url; if (!row.label) row.label = '访问地址' }
  else if (!(block.rows || []).some(r => r.kind === 'link' && r.value)) block.rows.unshift({ label: '访问地址', value: url, kind: 'link', note: '' })
}
const onLinkSvc = (block) => {
  const svc = draft.value.services.find(s => s.key === block.svc)
  if (!svc) return
  fillUrl(block, svc)
  if (!block.title) block.title = svc.name
  if (!block.icon || block.icon === '📊') block.icon = svc.icon || block.icon
}
const addBlockFromSvc = (key) => {
  const svc = draft.value.services.find(s => s.key === key)
  if (!svc) return
  const block = { title: svc.name || svc.target, icon: svc.icon || '📊', svc: svc.key, rows: [{ label: '访问地址', value: '', kind: 'link', note: '' }] }
  fillUrl(block, svc)
  draft.value.blocks.push(block)
}
const move = (arr, i, d) => {
  const j = i + d
  if (j < 0 || j >= arr.length) return
  const [item] = arr.splice(i, 1)
  arr.splice(j, 0, item)
}

const copy = async (text, key) => {
  await copyTextToClipboard(String(text || ''))
  copied.value = key
  setTimeout(() => { if (copied.value === key) copied.value = '' }, 1500)
}

const safeHref = (value) => {
  const v = String(value || '').trim()
  if (/^https?:\/\//i.test(v)) return v
  if (/^[a-z0-9.-]+(:\d+)?(\/.*)?$/i.test(v)) return `http://${v}`
  return '#'
}

// 资源
const num = (v) => Math.round(parseFloat(v) || 0)
const gb = (mb) => ((parseFloat(mb) || 0) / 1024).toFixed(1)
const pct = (a, b) => (parseFloat(b) > 0 ? Math.min(100, (parseFloat(a) || 0) / parseFloat(b) * 100) : 0)
const cpuPct = computed(() => Math.min(100, parseFloat(server.value.cpu) || 0))
const ramPct = computed(() => pct(server.value.ram_used, server.value.ram_total))
const swapPct = computed(() => pct(server.value.swap_used, server.value.swap_total))
const diskPct = computed(() => pct(server.value.disk_used, server.value.disk_total))
const barStyle = (p) => ({ width: `${Math.max(2, p)}%`, background: p > 90 ? 'var(--accent-red)' : p > 75 ? 'var(--accent-yellow)' : undefined })
const loadText = computed(() => {
  const l = server.value.load_avg
  if (!l) return '-'
  return Array.isArray(l) ? l.join(' ') : String(l)
})
const ramGb = computed(() => Math.round((parseFloat(server.value.ram_total) || 0) / 1024))
const shortCpu = computed(() => String(server.value.cpu_info || '').replace(/\(R\)|\(TM\)|CPU|Processor|\s+@.*$/gi, '').replace(/\s+/g, ' ').trim().slice(0, 32))
const realIp = ref({ v4: '', v6: '' })
const cleanIp = (v) => { const x = String(v || '').trim(); return x && x !== '0' && x !== '1' ? x : '' }
const ipText = computed(() => realIp.value.v4 || realIp.value.v6 || '')
// 公开接口会把 IP 隐藏成 0/1，管理员列表接口才有真实 IP；只在打开页面时取一次
const loadRealIp = async () => {
  const res = await http.postByIndex('/admin/api', { action: 'list' }, apiIndex.value, { autoRedirect: false })
  const item = (res?.data?.servers || []).find(s => String(s.id) === serverId.value)
  if (item) realIp.value = { v4: cleanIp(item.ip_v4), v6: cleanIp(item.ip_v6) }
}
const online = computed(() => isServerOnline(server.value, now.value))

const ago = (ms) => {
  if (!ms) return '无数据'
  const s = Math.max(0, Math.floor((now.value - ms) / 1000))
  if (s < 60) return `${s} 秒前`
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`
  return `${Math.floor(s / 86400)} 天前`
}
const toMs = (v) => {
  if (!v) return 0
  if (typeof v === 'string' && !/^\d+$/.test(v)) { const d = new Date(v).getTime(); return isNaN(d) ? 0 : d }
  const n = parseInt(v); return n < 1e12 ? n * 1000 : n
}
const lastSeenText = computed(() => ago(toMs(server.value.report_timestamp ?? server.value.last_updated)))
const uptimeText = computed(() => {
  const b = toMs(server.value.boot_time)
  if (!b) return '-'
  const s = Math.floor((now.value - b) / 1000)
  return `${Math.floor(s / 86400)}天 ${Math.floor((s % 86400) / 3600)}小时 ${Math.floor((s % 3600) / 60)}分`
})
const reportStale = computed(() => !reportedAt.value || (now.value / 1000 - reportedAt.value) > 300)
const reportedText = computed(() => reportedAt.value
  ? `状态脚本最后上报：${ago(reportedAt.value * 1000)}${reportStale.value ? '（已超过 5 分钟，状态可能过期）' : ''}`
  : '状态脚本还没上报过，展开下方「状态上报脚本」安装')

const badge = (svc) => {
  if (!svc.check || svc.check === 'none') return { cls: 'b-none', text: '仅记录' }
  const st = status.value?.[svc.key]
  if (!st) return { cls: 'b-none', text: '未上报' }
  if (reportStale.value) return { cls: 'b-stale', text: '过期' }
  if (st === 'active') return { cls: 'b-ok', text: '运行中' }
  if (st === 'activating' || st === 'reloading') return { cls: 'b-warn', text: '启动中' }
  const zh = { inactive: '已停止', exited: '已停止', failed: '失败', created: '未启动', paused: '已暂停', restarting: '重启中', dead: '已停止', unknown: '未知' }
  return { cls: 'b-bad', text: zh[st] || st }
}

// 安装命令
const workerUrl = computed(() => {
  const bases = getApiBases()
  const base = bases[apiIndex.value] || bases[0] || ''
  return (base || window.location.origin).replace(/\/+$/, '')
})
const installCmd = computed(() => `curl -fsSL ${workerUrl.value}/console/agent.sh | sudo sh -s -- install ${workerUrl.value} ${serverId.value} ${reportToken.value}`)
const loopCmd = computed(() => `curl -fsSL ${workerUrl.value}/console/agent.sh -o /tmp/cfsm-console.sh && nohup sh /tmp/cfsm-console.sh loop ${workerUrl.value} ${serverId.value} ${reportToken.value} >/dev/null 2>&1 &`)
const uninstallCmd = computed(() => `curl -fsSL ${workerUrl.value}/console/agent.sh | sudo sh -s -- uninstall`)

onMounted(() => {
  if (!loggedIn.value) return
  load()
  loadRealIp().catch(() => {})
  timer = setInterval(() => { if (!editing.value && document.visibilityState === 'visible') load() }, 30000)
  clock = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  clearInterval(timer)
  clearInterval(clock)
})
</script>

<style scoped>
.console-container { padding-bottom: 24px; }
.console-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 12px 4px 14px; border-bottom: 1px solid var(--border-color); margin-bottom: 14px; flex-wrap: wrap; }
.console-back { color: var(--text-secondary); text-decoration: none; font-size: 12px; }
.console-back:hover { color: var(--accent-green); }
.console-title { font-size: 15px; margin: 4px 0 8px; display: flex; align-items: center; gap: 10px; color: var(--text-primary); }
.console-flag { width: 28px; height: 20px; border-radius: 3px; }
.console-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip { border: 1px solid var(--border-active); background: var(--bg-card); border-radius: 6px; padding: 2px 8px; font-size: 11px; color: var(--text-secondary); }
.chip-copy { cursor: pointer; }
.chip-copy em { color: var(--accent-green); font-style: normal; }
.console-head-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.console-actions { display: flex; gap: 8px; }
.live-pill { border: 1px solid var(--border-active); border-radius: 999px; padding: 4px 12px; font-size: 11px; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 8px; }
.live-pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--text-secondary); }
.live-pill.on i { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
.live-pill.off i { background: var(--accent-red); }
.console-error { border: 1px solid var(--accent-red); color: var(--accent-red); border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; }
.console-empty { border: 1px dashed var(--border-active); border-radius: 12px; padding: 24px; text-align: center; color: var(--text-secondary); margin-bottom: 18px; }

.res-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
.res-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 14px; }
.res-top { display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 11px; }
.res-pct { color: var(--text-secondary); }
.res-big { font-size: 17px; font-weight: 700; color: var(--text-primary); margin: 8px 0; }
.res-big small { font-size: 11px; font-weight: 400; color: var(--text-secondary); }
.bar { height: 7px; background: var(--bg-hover); border-radius: 99px; overflow: hidden; }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-blue)); border-radius: 99px; transition: width .4s; }
.bar-fill.purple { background: linear-gradient(90deg, var(--accent-purple), var(--accent-pink)); }
.res-foot { display: flex; justify-content: space-between; color: var(--text-secondary); font-size: 10px; margin-top: 8px; }

.w-port { width: 76px; flex: none; }
.info-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.edit-actions { display: flex; gap: 8px; align-items: center; }
.info-block { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 16px; margin-bottom: 10px; }
.info-title { color: var(--accent-blue); font-weight: 700; font-size: 12px; margin-bottom: 6px; }
.info-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 3px 0; font-size: 11px; }
.info-label { color: var(--text-secondary); white-space: nowrap; }
.info-value { border: 1px solid var(--border-active); background: var(--bg-secondary); border-radius: 6px; padding: 2px 8px; max-width: 100%; overflow-x: auto; }
.info-value code { font-family: ui-monospace, Menlo, Consolas, monospace; color: var(--text-primary); white-space: pre; }
.info-value a { color: var(--accent-blue); text-decoration: none; font-family: ui-monospace, Menlo, Consolas, monospace; }
.info-note { color: var(--text-secondary); font-size: 11px; }
.mini-btn { border: 1px solid var(--border-active); background: transparent; color: var(--text-secondary); border-radius: 6px; padding: 3px 9px; font-size: 11px; cursor: pointer; }
.mini-btn:hover:not(:disabled) { color: var(--accent-green); border-color: var(--accent-green); }
.mini-btn.danger:hover { color: var(--accent-red); border-color: var(--accent-red); }
.mini-btn:disabled { opacity: .35; cursor: default; }

.svc-head { display: flex; justify-content: space-between; align-items: baseline; margin: 26px 0 12px; flex-wrap: wrap; gap: 6px; }
.svc-head h2, .edit-section-head h2 { font-size: 13px; color: var(--text-primary); margin: 0; }
.svc-meta { color: var(--text-secondary); font-size: 11px; }
.svc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.svc-card { display: flex; align-items: center; gap: 10px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 12px; min-width: 0; }
.svc-icon { width: 32px; height: 32px; flex: none; display: flex; align-items: center; justify-content: center; font-size: 16px; background: var(--bg-hover); border-radius: 10px; }
.svc-body { flex: 1; min-width: 0; }
.svc-name { font-weight: 700; color: var(--text-primary); font-size: 12px; }
.svc-desc { color: var(--text-secondary); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.badge { flex: none; display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 2px 9px; font-size: 11px; font-weight: 600; }
.badge i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.b-ok { color: var(--accent-green); background: color-mix(in srgb, var(--accent-green) 14%, transparent); }
.b-bad { color: var(--accent-red); background: color-mix(in srgb, var(--accent-red) 14%, transparent); }
.b-warn, .b-stale { color: var(--accent-yellow); background: color-mix(in srgb, var(--accent-yellow) 14%, transparent); }
.b-none { color: var(--text-secondary); background: var(--bg-hover); }

.agent-box { margin-top: 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 16px; }
.agent-box summary { cursor: pointer; color: var(--text-primary); font-weight: 600; font-size: 12px; }
.agent-tip { color: var(--text-secondary); font-size: 12px; margin: 10px 0; line-height: 1.6; }
.agent-row { display: flex; align-items: center; gap: 8px; margin: 8px 0; flex-wrap: wrap; }
.agent-cmd { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; border: 1px solid var(--border-active); background: var(--bg-secondary); border-radius: 6px; padding: 6px 10px; font-size: 11px; color: var(--text-primary); }

.edit-section { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px 20px; margin-bottom: 16px; }
.edit-section-head { display: flex; justify-content: space-between; align-items: center; }
.edit-block { border: 1px dashed var(--border-active); border-radius: 10px; padding: 12px; margin: 12px 0; }
.edit-line { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
.edit-line.sub { padding-left: 24px; }
.edit-line .form-input, .edit-line .form-select { margin: 0; }
.icon-select { width: 64px !important; flex: none; }
.w-title { flex: 1; width: auto !important; min-width: 200px; }
.w-label { width: 150px !important; flex: none; }
.w-kind { width: 170px !important; flex: none; }
.w-value { flex: 1; width: auto !important; min-width: 220px; }
.w-note { width: 170px !important; flex: none; }




.disc-box { margin-top: 14px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px 16px; }
.disc-head { display: flex; justify-content: space-between; align-items: baseline; }
.disc-sub { font-size: 11px; color: var(--text-secondary); margin: 8px 0 10px; display: flex; gap: 10px; align-items: center; }
.disc-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; }
.disc-item { display: flex; align-items: center; gap: 8px; font-size: 11px; padding: 4px 8px; border-radius: 8px; background: var(--bg-secondary); min-width: 0; }
.disc-icon { width: 20px; text-align: center; }
.disc-name { font-weight: 600; color: var(--text-primary); white-space: nowrap; }
.disc-raw { color: var(--text-secondary); font-size: 11px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mini-btn.ghost { opacity: .6; }
.disc-more { margin-top: 12px; }
.disc-more summary { cursor: pointer; font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }
.disc-ports { margin-top: 12px; font-size: 11px; color: var(--text-secondary); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.disc-ports code { background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 6px; padding: 1px 7px; color: var(--text-primary); }
@media (max-width: 760px) { .disc-list { grid-template-columns: 1fr; } }

@media (max-width: 1100px) {
  .res-grid { grid-template-columns: repeat(2, 1fr); }
  .svc-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .res-grid, .svc-grid { grid-template-columns: 1fr; }
  .console-head-right { align-items: flex-start; }
}
</style>
