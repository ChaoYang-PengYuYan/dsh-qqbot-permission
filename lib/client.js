window.__ModuleLoader__.load({ id: "dsh-qqbot-permission", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
/**
 * dsh-qqbot-permission 浏览器半边：设置页「QQ机器人权限」栏目。
 *
 * 上半部分：能不能认出 QQ 会话、QQ 插件的安全设置、拦截统计（/qqbot-permission/status）。
 * 下半部分：按分组勾选 QQ 机器人能用的工具、其他选项（/qqbot-permission/config），保存后宿主写回 profile 并热重载插件。
 * 运行时依赖只有 react（客户端平台提供），按 dsh 客户端模块契约以 CJS 闭包加载。
 */
const React = require('react');
const h = React.createElement;

const STATUS_PATH = '/qqbot-permission/status';
const CONFIG_PATH = '/qqbot-permission/config';
const WORKSPACE_PATH = '/qqbot-permission/qq-workspace';
const OPEN_DIR_PATH = '/qqbot-permission/open-dir';
const STYLE_ID = 'qbperm-styles';
const RISK_TEXT = { safe: '安全', caution: '谨慎', danger: '危险' };
const MODE_TEXT = { open: '所有人都能用', allowlist: '只有白名单', disabled: '已关闭' };
const DETECT_TEXT = { prompt: '提示词', cwd: '工作目录', parent: '上级 QQ 会话' };
const LOG_KIND_TEXT = { approval: '越权审批', call: '工具调用', fetch: '打开内网网址' };

function installStyles() {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID) !== null)
        return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.qbperm-panel { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 16px; font-size: 14px;
  color: var(--dsw-alias-label-primary, inherit); }
.qbperm-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.qbperm-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; }
.qbperm-dot { width: 10px; height: 10px; border-radius: 50%; background: #9aa0a6; }
.qbperm-dot--on { background: #22a861; }
.qbperm-dot--warn { background: #e0a800; }
.qbperm-dot--off { background: var(--dsw-alias-danger, #f26d6d); }
.qbperm-btn { font: inherit; font-size: 13px; padding: 6px 16px; border-radius: 8px; cursor: pointer; color: inherit;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.4)); background: transparent; }
.qbperm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12)); }
.qbperm-btn:disabled { opacity: 0.5; cursor: default; }
.qbperm-btn--small { font-size: 12px; padding: 3px 10px; }
.qbperm-btn--primary { border-color: transparent; background: var(--dsw-alias-brand, #4d6bfe); color: #fff; font-weight: 500; }
.qbperm-btn--primary:hover:not(:disabled) { background: var(--dsw-alias-brand-strong, #3b5cf0); }
.qbperm-card { border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.25)); border-radius: 10px; padding: 12px 14px; }
.qbperm-card h4 { margin: 0 0 8px; font-size: 13px; font-weight: 600; opacity: 0.8; }
.qbperm-kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 13px; margin: 0; }
.qbperm-kv dt { opacity: 0.65; }
.qbperm-kv dd { margin: 0; word-break: break-all; }
.qbperm-bad { color: var(--dsw-alias-danger, #d93f3f); }
.qbperm-good { color: #22a861; }
.qbperm-warn { color: #b88400; }
.qbperm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.qbperm-hint { margin: 0; font-size: 12px; opacity: 0.6; }
.qbperm-dir { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.qbperm-section { display: flex; flex-direction: column; gap: 8px; padding: 10px 0 14px;
  border-bottom: 1px dashed var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.25)); }
.qbperm-section:last-of-type { border-bottom: none; }
.qbperm-section h5 { margin: 0; font-size: 13px; font-weight: 600; }
.qbperm-presets { display: flex; gap: 8px; flex-wrap: wrap; }
.qbperm-tool { display: grid; grid-template-columns: 20px 1fr; gap: 2px 8px; align-items: start; padding: 6px 4px; border-radius: 6px; cursor: pointer; }
.qbperm-tool:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.08)); }
.qbperm-tool input { margin: 3px 0 0; width: 16px; height: 16px; cursor: pointer; }
.qbperm-tool-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; }
.qbperm-tool-desc { grid-column: 2; font-size: 12px; opacity: 0.65; }
.qbperm-tag { font-size: 11px; padding: 0 6px; border-radius: 4px; line-height: 18px; border: 1px solid currentColor; }
.qbperm-tag--safe { color: #22a861; }
.qbperm-tag--caution { color: #b88400; }
.qbperm-tag--danger { color: var(--dsw-alias-danger, #d93f3f); }
.qbperm-tag--muted { color: inherit; opacity: 0.5; }
.qbperm-part { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
  margin: 14px 0 0; font-size: 14px; font-weight: 600; }
.qbperm-part-actions { display: flex; gap: 6px; font-weight: normal; }
.qbperm-section--group { gap: 2px; padding: 4px 0; }
.qbperm-group-head { display: flex; align-items: center; gap: 4px; }
.qbperm-group-head > input { margin: 0 4px; width: 16px; height: 16px; cursor: pointer; flex: none; }
.qbperm-fold { flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 4px; border: none; border-radius: 6px;
  font: inherit; font-size: 13px; color: inherit; text-align: left; background: transparent; cursor: pointer; }
.qbperm-fold:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.08)); }
.qbperm-caret { display: inline-block; width: 12px; opacity: 0.6; }
.qbperm-group-desc { padding-left: 28px; }
.qbperm-group-body { padding-left: 24px; }
.qbperm-dirty { color: var(--dsw-alias-brand, #4d6bfe); }
.qbperm-field { display: grid; grid-template-columns: 180px 1fr; gap: 4px 12px; align-items: start; font-size: 13px; }
.qbperm-field > label { padding-top: 6px; opacity: 0.8; }
.qbperm-field.qbperm-dirty > label { opacity: 1; }
.qbperm-field input[type=text], .qbperm-field textarea, .qbperm-add input { font: inherit; font-size: 13px; width: 100%; box-sizing: border-box;
  padding: 6px 8px; border-radius: 6px; color: inherit; background: var(--dsw-alias-bg-layer-1, transparent);
  border: 1px solid var(--dsw-alias-border-l2, rgba(128, 128, 128, 0.4)); }
.qbperm-field textarea { min-height: 54px; resize: vertical; }
.qbperm-field input[type=checkbox] { margin-top: 8px; width: 16px; height: 16px; }
.qbperm-add { display: flex; gap: 8px; align-items: center; }
.qbperm-add input { flex: 1; }
.qbperm-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding-top: 6px; }
.qbperm-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.qbperm-table th, .qbperm-table td { text-align: left; padding: 6px 8px; vertical-align: top;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.2)); }
.qbperm-table th { font-weight: 600; opacity: 0.7; white-space: nowrap; }
@media (max-width: 640px) { .qbperm-field { grid-template-columns: 1fr; } .qbperm-field > label { padding-top: 0; } }
`;
    document.head.appendChild(style);
}

function fmtTime(ms) {
    if (!ms)
        return '—';
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return d.toDateString() === new Date().toDateString() ? time : `${d.getMonth() + 1}-${d.getDate()} ${time}`;
}

function Kv(pairs) {
    return h('dl', { className: 'qbperm-kv' }, ...pairs.flatMap(([k, v, cls]) => [
        h('dt', { key: `${k}-t` }, k),
        h('dd', { key: `${k}-d`, className: cls }, v),
    ]));
}

async function fetchJson(url, init) {
    const res = await fetch(url, { cache: 'no-store', ...init });
    let body = null;
    try {
        body = await res.json();
    }
    catch {
        // 非 JSON（例如插件正在重载时的 404）
    }
    if (!res.ok)
        throw new Error(body?.error ?? `HTTP ${res.status}`);
    return body;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- 状态 ----------

function badgeOf(data) {
    if (!data)
        return { cls: '', text: '读取中…' };
    if (!data.enabled)
        return { cls: 'qbperm-dot--off', text: '已关闭：QQ 机器人可以用全部工具' };
    if (!data.guardAvailable)
        return { cls: 'qbperm-dot--warn', text: '只隐藏了工具，执行时拦截不可用（DSH 版本不支持）' };
    if (!data.qqbot.found)
        return { cls: 'qbperm-dot--warn', text: '已启用，但没找到 QQ 机器人插件的配置' };
    return { cls: 'qbperm-dot--on', text: `已启用：QQ 机器人只能用 ${data.allow.length} 个工具` };
}

function StatusView({ data, loading, error, onRefresh }) {
    const [msg, setMsg] = React.useState(null);
    const badge = badgeOf(data);
    const children = [
        h('div', { className: 'qbperm-head', key: 'head' },
            h('span', { className: 'qbperm-badge' }, h('span', { className: `qbperm-dot ${badge.cls}` }), badge.text),
            h('button', { type: 'button', className: 'qbperm-btn', disabled: loading, onClick: onRefresh }, loading ? '读取中…' : '刷新')),
    ];
    if (error)
        children.push(h('p', { className: 'qbperm-hint qbperm-bad', key: 'err' }, error));
    if (!data)
        return h(React.Fragment, null, ...children);

    const q = data.qqbot;
    const setWorkspace = async () => {
        setMsg(null);
        try {
            const body = await fetchJson(WORKSPACE_PATH, { method: 'POST' });
            setMsg({ ok: true, text: body.message });
            setTimeout(onRefresh, 1500);
        }
        catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        }
    };
    const openDir = async (dir) => {
        setMsg(null);
        try {
            await fetchJson(OPEN_DIR_PATH, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dir }) });
        }
        catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        }
    };
    const promptRow = (on, scope) => (on
        ? h('span', { className: 'qbperm-good' }, `✓ QQ 插件填了${scope}额外提示词，每轮都能认出`)
        : h('span', { className: 'qbperm-warn' }, `✗ QQ 插件的${scope}额外提示词是空的，${scope}只能靠工作目录认出`));
    const cwdRow = data.cwdPrefixes.length
        ? h('span', null, h('span', { className: 'qbperm-good' }, '✓ '), ...data.cwdPrefixes.map((p, i) => h('span', { key: i, className: 'qbperm-dir' },
            h('span', { className: 'qbperm-mono' }, p),
            h('button', { type: 'button', className: 'qbperm-btn qbperm-btn--small', title: '在文件管理器里打开', onClick: () => { void openDir(p); } }, '打开'))))
        : h('span', null,
            h('span', { className: 'qbperm-warn' }, '✗ QQ 插件没设专用工作目录（现在用的是 DSH 自己的目录，沙箱写入边界也在那里） '),
            h('button', { type: 'button', className: 'qbperm-btn qbperm-btn--small', onClick: () => { void setWorkspace(); } }, '设为专用目录'),
            h('p', { className: 'qbperm-hint' }, `会把 QQ 插件的 cwd 设为 ${data.qqWorkspace}（空文件夹），QQ 插件会重新加载`));
    const modeRow = (mode) => h('span', { className: mode === 'open' ? 'qbperm-warn' : '' },
        MODE_TEXT[mode] ?? mode, mode === 'open' ? '（建议在 QQ 机器人设置里改成白名单）' : '');

    children.push(h('div', { className: 'qbperm-card', key: 'detect' },
        h('h4', null, '怎么认出 QQ 会话'),
        q.found
            ? Kv([
                ['群聊', promptRow(q.groupPrompt, '群聊')],
                ['私聊', promptRow(q.directPrompt, '私聊')],
                ['工作目录', cwdRow],
                ['群聊访问', modeRow(q.groupMode)],
                ['私聊访问', modeRow(q.c2cMode)],
            ])
            : h('p', { className: 'qbperm-hint qbperm-bad' }, 'profile 的 cordis.patch.yml 里没找到 QQ 机器人插件（im-qqbot）这一行：先装好、配好 QQ 机器人插件'),
        msg ? h('p', { className: `qbperm-hint ${msg.ok ? 'qbperm-good' : 'qbperm-bad'}` }, msg.text) : null));

    const s = data.stats;
    children.push(h('div', { className: 'qbperm-card', key: 'stats' },
        h('h4', null, '运行情况（插件重启或保存配置后清零）'),
        Kv([
            ['认出 QQ 请求', s.recognized ? `${s.recognized} 次，最近 ${fmtTime(s.lastRecognized?.time)}（靠${DETECT_TEXT[s.lastRecognized?.by] ?? '—'}认出）` : '还没有：在 QQ 里 @ 机器人说句话再刷新'],
            ['AI 能看到的工具', s.recognized ? (s.visible.length ? h('span', { className: 'qbperm-mono' }, s.visible.join('  ')) : '没有（只能聊天）') : '—'],
            ['已隐藏工具', `${s.hidden} 个次`],
            ['拦截工具调用', `${s.blocked} 次`, s.blocked ? 'qbperm-warn' : ''],
            ['拒绝越权审批', `${s.rejectedApprovals} 次`],
        ])));

    children.push(h('div', { className: 'qbperm-card', key: 'log' },
        h('h4', null, '拦截记录（最多 50 条）'),
        data.log.length
            ? h('table', { className: 'qbperm-table' },
                h('thead', null, h('tr', null, ...['时间', '类型', '工具 / 网址'].map((t) => h('th', { key: t }, t)))),
                h('tbody', null, ...data.log.map((r, i) => h('tr', { key: i },
                    h('td', { className: 'qbperm-mono' }, fmtTime(r.time)),
                    h('td', null, LOG_KIND_TEXT[r.kind] ?? r.kind),
                    h('td', { className: 'qbperm-mono' }, r.tool || '—')))))
            : h('p', { className: 'qbperm-hint' }, '还没有拦截过')));
    return h(React.Fragment, null, ...children);
}

// ---------- 权限勾选 ----------

function ToolRow({ tool, checked, dirty, missing, onToggle }) {
    return h('label', { className: 'qbperm-tool' },
        h('input', { type: 'checkbox', checked, onChange: () => onToggle(tool.name) }),
        h('span', { className: `qbperm-tool-title${dirty ? ' qbperm-dirty' : ''}` },
            h('span', null, tool.label ?? tool.name),
            h('span', { className: 'qbperm-mono' }, tool.name),
            tool.risk ? h('span', { className: `qbperm-tag qbperm-tag--${tool.risk}` }, RISK_TEXT[tool.risk]) : null,
            missing ? h('span', { className: 'qbperm-tag qbperm-tag--muted' }, '这台电脑上没装') : null),
        tool.desc ? h('span', { className: 'qbperm-tool-desc' }, tool.desc) : null);
}

const countTag = (on, total) => h('span', { className: 'qbperm-tag qbperm-tag--muted' },
    on === total ? '全部放行' : on ? `放行 ${on}/${total}` : '全部禁止');

/** 可折叠的一组工具：点标题展开 / 收起，收起时标题旁仍能看到放行了几个 */
function ToolGroup({ open, onToggle, check, title, extra = [], desc, children }) {
    return h('div', { className: 'qbperm-section qbperm-section--group' },
        h('div', { className: 'qbperm-group-head' },
            check ?? null,
            h('button', { type: 'button', className: 'qbperm-fold', 'aria-expanded': open, onClick: onToggle },
                h('span', { className: 'qbperm-caret' }, open ? '▾' : '▸'),
                h('strong', null, title),
                ...extra)),
        desc ? h('p', { className: 'qbperm-hint qbperm-group-desc' }, desc) : null,
        open ? h('div', { className: 'qbperm-group-body' }, children) : null);
}

/** 一个插件（或一个 MCP 服务器）注册的全部工具：标题旁的勾选框整组放行 / 禁止 */
function PluginGroup({ plugin, set, open, onToggle, onChange, row }) {
    const names = plugin.tools.map((t) => t.name);
    const on = names.filter((n) => set.has(n)).length;
    const ref = React.useRef(null);
    React.useEffect(() => {
        if (ref.current)
            ref.current.indeterminate = on > 0 && on < names.length;
    });
    return h(ToolGroup, {
        open,
        onToggle,
        check: h('input', { ref, type: 'checkbox', title: '整组放行 / 禁止', checked: on === names.length, onChange: () => onChange(names, on < names.length) }),
        title: plugin.title,
        extra: [plugin.version ? h('span', { className: 'qbperm-mono' }, plugin.version) : null, countTag(on, names.length)],
        desc: plugin.description,
    }, ...plugin.tools.map((t) => row({ ...t, label: t.label ?? '', desc: t.desc || '插件没写说明' })));
}

// 展开了哪些分组，按浏览器记住（只是界面偏好，读写失败就当全收起）
const OPEN_KEY = 'qbperm-open-groups';
function loadOpen() {
    try {
        return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]'));
    }
    catch {
        return new Set();
    }
}
function saveOpen(open) {
    try {
        localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
    }
    catch {
        // 隐私模式等拿不到 localStorage：只是下次打开不记得
    }
}

function PermissionPicker({ status, allow, original, onChange }) {
    const [extra, setExtra] = React.useState('');
    const [open, setOpen] = React.useState(loadOpen);
    const fold = (ids, value) => {
        const next = new Set(open);
        for (const id of ids)
            value ? next.add(id) : next.delete(id);
        saveOpen(next);
        setOpen(next);
    };
    const set = new Set(allow);
    const orig = new Set(original);
    // DSH 自带工具多数挂在 agent 预设里，全局注册表里看不到；要等认出过一次 QQ 请求、拿到 QQ 会话实际的工具列表，才能判断哪些没装
    const installed = status.registered && status.stats.recognized ? new Set([...status.registered, ...status.stats.seen]) : null;
    const toggle = (name) => onChange(set.has(name) ? allow.filter((n) => n !== name) : [...allow, name]);
    const row = (tool) => h(ToolRow, {
        key: tool.name,
        tool,
        checked: set.has(tool.name),
        dirty: set.has(tool.name) !== orig.has(tool.name),
        missing: installed !== null && !installed.has(tool.name),
        onToggle: toggle,
    });
    const add = () => {
        const name = extra.trim();
        if (name && !set.has(name))
            onChange([...allow, name]);
        setExtra('');
    };
    const dangerous = status.catalog.groups.flatMap((g) => g.tools).filter((t) => t.risk === 'danger' && set.has(t.name));
    const onCount = (tools) => tools.filter((t) => set.has(t.name)).length;
    const builtinIds = status.catalog.groups.map((g) => `builtin:${g.id}`);
    const pluginIds = [...status.catalog.plugins.map((p) => `plugin:${p.id}`), ...(status.catalog.others.length ? ['others'] : [])];
    const partHead = (text, ids) => h('div', { className: 'qbperm-part' },
        h('span', null, text),
        ids.length ? h('span', { className: 'qbperm-part-actions' },
            h('button', { type: 'button', className: 'qbperm-btn qbperm-btn--small', onClick: () => fold(ids, true) }, '全部展开'),
            h('button', { type: 'button', className: 'qbperm-btn qbperm-btn--small', onClick: () => fold(ids, false) }, '全部收起')) : null);
    return h(React.Fragment, null,
        h('div', { className: 'qbperm-section' },
            h('h5', null, '一键套用'),
            h('div', { className: 'qbperm-presets' }, ...status.catalog.presets.map((p) => h('button', {
                key: p.id, type: 'button', className: 'qbperm-btn qbperm-btn--small', title: p.desc,
                onClick: () => onChange([...p.allow]),
            }, `${p.label}（${p.desc}）`)))),
        partHead('DSH 自带的工具', builtinIds),
        ...status.catalog.groups.map((g, i) => h(ToolGroup, {
            key: g.id,
            open: open.has(builtinIds[i]),
            onToggle: () => fold([builtinIds[i]], !open.has(builtinIds[i])),
            title: g.title,
            extra: [countTag(onCount(g.tools), g.tools.length)],
        }, ...g.tools.map(row))),
        partHead('已安装的插件', pluginIds),
        status.catalog.plugins.length
            ? status.catalog.plugins.map((p) => h(PluginGroup, {
                key: p.id, plugin: p, set, row,
                open: open.has(`plugin:${p.id}`),
                onToggle: () => fold([`plugin:${p.id}`], !open.has(`plugin:${p.id}`)),
                onChange: (names, on) => onChange(on
                    ? [...allow, ...names.filter((n) => !set.has(n))]
                    : allow.filter((n) => !names.includes(n))),
            }))
            : h('p', { className: 'qbperm-hint', key: 'no-plugins' }, '没找到其他插件注册的工具'),
        status.catalog.others.length ? h(ToolGroup, {
            key: 'others',
            open: open.has('others'),
            onToggle: () => fold(['others'], !open.has('others')),
            title: '其他工具（找不到是哪个插件注册的）',
            extra: [countTag(onCount(status.catalog.others), status.catalog.others.length)],
        }, ...status.catalog.others.map((t) => row({ ...t, label: t.label ?? '', desc: t.desc || '没有说明：不确定它能做什么就别开' }))) : null,
        h('div', { className: 'qbperm-section', key: 'add' },
            h('h5', null, '手动添加工具名'),
            h('div', { className: 'qbperm-add' },
                h('input', { type: 'text', value: extra, placeholder: '例如 some_tool_name', onChange: (e) => setExtra(e.target.value),
                    onKeyDown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } } }),
                h('button', { type: 'button', className: 'qbperm-btn qbperm-btn--small', onClick: add }, '添加')),
            h('p', { className: 'qbperm-hint' }, '当前白名单：',
                allow.length ? h('span', { className: 'qbperm-mono' }, allow.join('  ')) : '空（只能聊天）'),
            dangerous.length ? h('p', { className: 'qbperm-hint qbperm-bad' },
                `注意：勾了 ${dangerous.map((t) => t.label).join('、')}，群友可以借机器人改动这台电脑。`) : null));
}

// ---------- 配置表单 ----------

const OPTION_FIELDS = [
    { key: 'enabled', type: 'bool', label: '启用（总开关）', hint: '关掉后 QQ 机器人恢复使用全部工具' },
    { key: 'hideTools', type: 'bool', label: '不给 AI 看白名单以外的工具', hint: '模型看不到就不会去试，也省 token；就算关掉，执行时照样拦截' },
    { key: 'rejectApprovals', type: 'bool', label: '拒绝 QQ 里的越权审批', hint: 'QQ 插件会把「允许 / 拒绝」按钮发到群里，群里任何人都能点；开着就直接拒绝' },
    { key: 'webFetchPublicOnly', type: 'bool', label: 'web_fetch 只许打开公网网址', hint: '放行了「读取网页」时生效：localhost、127.0.0.1、192.168.x.x、局域网主机名等一律拦截，防止群友借机器人探本机和内网' },
    { key: 'notice.enabled', type: 'bool', label: '告诉 AI 它能用哪些工具' },
    { key: 'notice.text', type: 'textarea', label: '权限说明', hint: '{tools} 会换成白名单里的工具名；白名单为空时用内置的「只能聊天」说明' },
    { key: 'denyMessage', type: 'textarea', label: '拦截时回给 AI 的话', hint: '{tool} 会换成被拦的工具名' },
    { key: 'cwdPrefixes', type: 'list', label: '额外按工作目录识别', hint: '会话工作目录在这些目录下面就算 QQ 会话，多个用逗号分隔；QQ 插件自己的 cwd 会自动加上' },
];

const getPath = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
function setPath(obj, key, value) {
    const [top, sub] = key.split('.');
    return sub === undefined ? { ...obj, [top]: value } : { ...obj, [top]: { ...(obj[top] ?? {}), [sub]: value } };
}

function Field({ field, value, dirty, onChange }) {
    const id = `qbperm-${field.key}`;
    let input;
    if (field.type === 'bool')
        input = h('input', { id, type: 'checkbox', checked: Boolean(value), onChange: (e) => onChange(e.target.checked) });
    else if (field.type === 'textarea')
        input = h('textarea', { id, value: value ?? '', onChange: (e) => onChange(e.target.value) });
    else if (field.type === 'list')
        input = h('input', { id, type: 'text', value: Array.isArray(value) ? value.join(', ') : (value ?? ''),
            onChange: (e) => onChange(e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)) });
    else
        input = h('input', { id, type: 'text', value: value ?? '', onChange: (e) => onChange(e.target.value) });
    return h('div', { className: `qbperm-field${dirty ? ' qbperm-dirty' : ''}` },
        h('label', { htmlFor: id }, field.label),
        h('div', null, input, field.hint ? h('p', { className: 'qbperm-hint' }, field.hint) : null));
}

function ConfigForm({ status, onSaved }) {
    const [loaded, setLoaded] = React.useState(null);
    const [form, setForm] = React.useState(null);
    const [saving, setSaving] = React.useState(false);
    const [msg, setMsg] = React.useState(null);

    const load = React.useCallback(async () => {
        try {
            const body = await fetchJson(CONFIG_PATH);
            setLoaded(body.config);
            setForm(body.config);
        }
        catch (err) {
            setMsg({ ok: false, text: `读取配置失败：${err instanceof Error ? err.message : String(err)}` });
        }
    }, []);
    React.useEffect(() => { void load(); }, [load]);

    if (!form || !status)
        return h('div', { className: 'qbperm-card' }, h('h4', null, '权限'), h('p', { className: 'qbperm-hint' }, msg?.text ?? '读取中…'));

    const tops = ['enabled', 'allow', 'hideTools', 'rejectApprovals', 'webFetchPublicOnly', 'notice', 'denyMessage', 'cwdPrefixes'];
    const dirtyTops = tops.filter((t) => !same(form[t], loaded[t]));
    const save = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const patch = Object.fromEntries(dirtyTops.map((t) => [t, form[t]]));
            const body = await fetchJson(CONFIG_PATH, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ patch }),
            });
            setMsg({ ok: true, text: body.message ?? '已保存' });
            // 插件热重载需要一点时间：稍等后重新读取配置和状态
            setTimeout(() => { void load(); onSaved(); }, 2000);
        }
        catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
        }
        finally {
            setSaving(false);
        }
    };

    return h('div', { className: 'qbperm-card' },
        h('h4', null, 'QQ 机器人能用的工具（勾上的才能用，其余一律拦截）'),
        h(PermissionPicker, { status, allow: form.allow ?? [], original: loaded.allow ?? [], onChange: (v) => setForm((f) => ({ ...f, allow: v })) }),
        h('div', { className: 'qbperm-section' },
            h('h5', null, '其他选项'),
            ...OPTION_FIELDS.map((field) => h(Field, {
                key: field.key,
                field,
                value: getPath(form, field.key),
                dirty: !same(getPath(form, field.key), getPath(loaded, field.key)),
                onChange: (v) => setForm((f) => setPath(f, field.key, v)),
            }))),
        h('div', { className: 'qbperm-actions' },
            h('button', { type: 'button', className: 'qbperm-btn qbperm-btn--primary', disabled: saving || !dirtyTops.length, onClick: () => { void save(); } },
                saving ? '保存中…' : (dirtyTops.length ? '保存配置' : '没有修改')),
            h('button', { type: 'button', className: 'qbperm-btn', disabled: saving || !dirtyTops.length, onClick: () => { setForm(loaded); setMsg(null); } }, '撤销修改'),
            msg ? h('span', { className: msg.ok ? 'qbperm-good' : 'qbperm-bad' }, msg.text) : null),
        h('p', { className: 'qbperm-hint' }, '改过的项会变成蓝色。保存后写入 dsh 配置文件，插件自动重新加载，下一条 QQ 消息起生效。'));
}

// ---------- 栏目 ----------

function QqbotPermissionPanel() {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const load = React.useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setData(await fetchJson(STATUS_PATH));
        }
        catch (err) {
            setError(`读取插件状态失败（${err instanceof Error ? err.message : String(err)}）：插件可能没有启动或正在重新加载`);
        }
        finally {
            setLoading(false);
        }
    }, []);
    React.useEffect(() => { void load(); }, [load]);

    return h('div', { className: 'qbperm-panel' },
        h(StatusView, { data, loading, error, onRefresh: () => { void load(); } }),
        h(ConfigForm, { status: data, onSaved: () => { void load(); } }));
}

exports.name = 'qqbot-permission-client';
exports.inject = ['slots'];
exports.QqbotPermissionPanel = QqbotPermissionPanel;
exports.apply = function apply(ctx) {
    installStyles();
    const slots = ctx.slots;
    const stop = slots.inject('settings.section', () => slots.register(
        { name: 'settings.section', id: 'qqbot-permission', order: 9, label: 'QQ机器人权限' },
        QqbotPermissionPanel,
    ));
    ctx.effect(() => () => stop(), 'qqbot-permission-client.section');
};
return module.exports; } });
