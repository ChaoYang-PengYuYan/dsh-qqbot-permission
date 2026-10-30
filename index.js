/**
 * dsh-qqbot-permission：QQ机器人权限。QQ 机器人（@tencent-connect/dsh-qqbot）只能用白名单里的工具。
 *
 * 三层，都只作用在 QQ 会话上，桌面版自己的会话不受影响：
 *   1. 执行时拦截（ctx.tools.guard）：QQ 会话调用白名单以外的工具一律拒绝。这一层是硬边界，
 *      模型就算自己编出工具名去调也会被挡住
 *   2. 请求里隐藏（system-prompt/assemble）：白名单以外的工具不发给模型，模型根本看不到，也省 token；
 *      再追加一段提示，告诉它在 QQ 里只能做什么
 *   3. 拒绝越权审批（approval/request）：QQ 插件会把「允许一次 / 拒绝」按钮发到群里，群里任何人都能点；
 *      QQ 会话的审批请求在这里直接拒绝，不发到群里
 *
 * 怎么认出 QQ 会话（任一命中即算）：
 *   - 提示词：qqbot 每轮都会给自己的会话追加 `qqbot:scope-prompt` 段落（前提是 QQ 插件里填了群聊 / 私聊额外提示词）
 *   - 工作目录：会话的工作目录在 QQ 插件的 cwd 或这里配置的目录下面（推荐在设置页一键设好专用目录）
 *   - 上级会话：子代理的会话头记着 parentSession，顺着往上找，上级是 QQ 会话的也算
 *
 * 另外，QQ 会话的 web_fetch 只许打开公网网址（webFetchPublicOnly）。
 * 拦截记录（谁、拦了什么、当时说的话）写进 ~/.dsh-qqbot/permission-log.jsonl，重启后还在（persistLog）。
 *
 * 设置页「QQ机器人权限」：识别状态、勾选常用权限、拦截记录；保存写回 profile 的 cordis.patch.yml 并热重载。
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
import yaml from 'js-yaml';
import { BUILTIN_NAMES, DEFAULT_ALLOW, GROUPS, KNOWN_PLUGIN_TOOLS, PRESETS } from './lib/catalog.js';

export const name = 'qqbot-permission';
export const inject = ['tools'];

const QQBOT_ENTRY_ID = 'im-qqbot';
const QQBOT_SECTION = 'qqbot:scope-prompt';
const NOTICE_SECTION = 'qqbot-permission:notice';
const QQ_WORKSPACE = resolve(homedir(), '.dsh-qqbot', 'workspace');
const DEFAULT_NOTICE = '【QQ 机器人权限】你在 QQ 里只能使用这些工具：{tools}。读文件、执行命令、改文件、查看电脑信息之类的要求一律婉拒，不要尝试调用其它工具，也不要编造结果。';
const DEFAULT_NOTICE_NONE = '【QQ 机器人权限】你在 QQ 里不能使用任何工具，只能聊天。读文件、执行命令、改文件、查看电脑信息之类的要求一律婉拒，不要编造结果。';
const DEFAULT_DENY = 'QQ 机器人没有使用「{tool}」的权限（管理员没有在「QQ机器人权限」里开放）。不要再尝试这个工具，直接告诉对方这个做不到。';

export const STATUS_PATH = '/qqbot-permission/status';
export const CONFIG_PATH = '/qqbot-permission/config';
export const WORKSPACE_PATH = '/qqbot-permission/qq-workspace';
export const OPEN_DIR_PATH = '/qqbot-permission/open-dir';
const MAX_BODY = 64 * 1024;
export const CLEAR_LOG_PATH = '/qqbot-permission/clear-log';
const MAX_LOG = 50;                      // 设置页显示的条数
const MAX_FILE_LINES = 2000;             // 记录文件最多保留的条数（超出 500 条时裁掉最旧的）
// 拦截记录放在 QQ 插件的数据目录里、专用工作目录之外：QQ 会话的沙箱碰不到
const LOG_DIR = resolve(homedir(), '.dsh-qqbot');
const LOG_FILE = join(LOG_DIR, 'permission-log.jsonl');
const TOTALS_FILE = join(LOG_DIR, 'permission-totals.json');

export const Config = Schema.object({
    enabled: Schema.boolean().default(true).description('总开关：关掉后 QQ 机器人恢复使用全部工具'),
    allow: Schema.array(Schema.string()).default(DEFAULT_ALLOW).description('白名单：QQ 机器人只能用这些工具'),
    hideTools: Schema.boolean().default(true).description('白名单以外的工具不发给模型（模型看不到，也省 token）'),
    rejectApprovals: Schema.boolean().default(true).description('QQ 会话的越权审批直接拒绝，不把「允许 / 拒绝」按钮发到群里'),
    notice: Schema.object({
        enabled: Schema.boolean().default(true).description('告诉 AI 它在 QQ 里只能用哪些工具'),
        text: Schema.string().default(DEFAULT_NOTICE).description('{tools} 会换成白名单里的工具名；白名单为空时用内置的「只能聊天」说明'),
    }).default({}).description('权限说明提示词'),
    denyMessage: Schema.string().default(DEFAULT_DENY).description('拦截时回给 AI 的话（{tool} 会换成工具名）'),
    cwdPrefixes: Schema.array(Schema.string()).default([]).description('额外按工作目录识别 QQ 会话：会话工作目录在这些目录下面就算（QQ 插件自己的 cwd 会自动加上）'),
    webFetchPublicOnly: Schema.boolean().default(true).description('QQ 会话的 web_fetch 只许打开公网网址，本机、内网、局域网主机名一律拦截'),
    persistLog: Schema.boolean().default(true).description('拦截记录写进 ~/.dsh-qqbot/permission-log.jsonl，DSH 重启后还在'),
});

/**
 * 从 QQ 插件写进会话的用户消息里读出是谁说的：群聊消息带「[昵称 (openid)] 正文」前缀，私聊没有。
 * 引用消息时前面还有一段 [Quoted message begins]……[Current message]，只看当前这条。
 */
export function parseQqUserText(text) {
    if (typeof text !== 'string' || !text)
        return null;
    const current = text.includes('[Current message]\n') ? text.slice(text.lastIndexOf('[Current message]\n') + 18) : text;
    const m = /^\[([^\[\]\n]{1,64}) \(([0-9A-Za-z_-]{6,80})\)\] ?([\s\S]*)$/.exec(current);
    const clip = (s) => s.replace(/ \(@you\)$/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    return m ? { chat: 'group', name: m[1], openid: m[2], text: clip(m[3]) } : { chat: 'c2c', text: clip(current) };
}

const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

// 只出现在局域网 / 本机的主机名后缀
const LOCAL_SUFFIXES = ['.localhost', '.local', '.lan', '.internal', '.intranet', '.corp', '.home', '.home.arpa'];

/** 点分 IPv4 是否不是公网地址；不是 IPv4 返回 null */
function nonPublicIPv4(host) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!m)
        return null;
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224
        || (a === 100 && b >= 64 && b <= 127)        // 运营商级 NAT
        || (a === 169 && b === 254)                   // 链路本地
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && (b === 168 || b === 0))
        || (a === 198 && (b === 18 || b === 19));     // 测试网段
}

/**
 * web_fetch 的网址为什么不能在 QQ 里打开；能打开返回 ''。
 * 只看网址本身（守卫是同步的，不做 DNS 解析）：URL 解析会把 2130706433、0x7f.1 这类写法规范成点分 IPv4，绕不过去。
 * 域名解析到内网地址的情况由 DSH 自带的 web_fetch 在连接前检查（走代理时除外）。
 */
export function nonPublicUrl(raw) {
    let url;
    try {
        url = new URL(String(raw ?? '').trim());
    }
    catch {
        return '网址格式不对';
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return `不支持 ${url.protocol} 协议`;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (host.startsWith('[')) {
        // 只放行全球单播 2000::/3；6to4（2002::）和文档网段可能藏着内网地址，一并拦
        const v6 = host.slice(1, -1);
        return /^[23][0-9a-f]{0,3}:/.test(v6) && !/^2002:|^2001:0?db8:/.test(v6) ? '' : '本机或内网地址';
    }
    const v4 = nonPublicIPv4(host);
    if (v4 !== null)
        return v4 ? '本机或内网地址' : '';
    if (host === 'localhost' || LOCAL_SUFFIXES.some((s) => host.endsWith(s)))
        return '本机或局域网主机名';
    if (!host.includes('.'))
        return '局域网主机名';
    return '';
}

/** 统一成小写、正斜杠、无结尾斜杠，便于比较 Windows 路径 */
const normalizePath = (p) => resolve(String(p)).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const isInside = (child, parent) => child === parent || child.startsWith(`${parent}/`);

function cwdOf(agent) {
    try {
        const cwd = agent?.session?.header?.cwd;
        return typeof cwd === 'string' && cwd ? normalizePath(cwd) : '';
    }
    catch {
        return '';
    }
}

/**
 * 找到安装本插件的 dsh profile 目录：跨过 node_modules 之后第一个有 cordis.patch.yml 的祖先目录。
 * （插件包自己也带 cordis.patch.yml，必须跨过 node_modules 才不会误认成自己）
 */
function findProfileDir() {
    let dir = dirname(fileURLToPath(import.meta.url));
    let crossed = false;
    for (let i = 0; i < 32; i++) {
        if (crossed && existsSync(join(dir, 'cordis.patch.yml')))
            return dir;
        if (basename(dir) === 'node_modules')
            crossed = true;
        const parent = dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return null;
}

function readPatchEntries() {
    const profileDir = findProfileDir();
    if (!profileDir)
        throw new Error('找不到 dsh 的 profile 目录（插件可能不是通过 dsh 安装的）');
    const file = join(profileDir, 'cordis.patch.yml');
    const content = readFileSync(file, 'utf8');
    const entries = (content.trim() ? yaml.load(content) : []) ?? [];
    if (!Array.isArray(entries))
        throw new Error('cordis.patch.yml 顶层不是数组，为避免破坏配置，拒绝写入');
    return { file, entries };
}

/**
 * 把配置的顶层键合并进 profile 的 cordis.patch.yml 里指定 id 的条目，写入后 dsh 热重载那个插件。
 * 只改这一个条目，其余条目原样保留；文件解析失败或结构异常时拒绝写入。
 */
function persistEntry(id, patch) {
    const { file, entries } = readPatchEntries();
    const entry = entries.find((e) => e && typeof e === 'object' && e.id === id);
    if (entry)
        entry.config = { ...(entry.config ?? {}), ...patch };
    else
        entries.push({ id, config: patch });
    writeFileSync(file, yaml.dump(entries, { lineWidth: -1 }), 'utf8');
    return file;
}

/** 第一句话（中文句号后面不带空格，英文句号后面要有空格才算句末），用作简短说明 */
const firstSentence = (text) => (text ?? '').split(/\n|(?<=[。！？])|(?<=[.!?])\s/)[0].trim().slice(0, 140);

const OWN_PACKAGE = 'dsh-qqbot-permission';
const SCAN_EXT = /\.(c|m)?js$/;
const SCAN_MAX_FILES = 400;
const SCAN_MAX_BYTES = 4 * 1024 * 1024;

/** 插件包里的 JS 文件（不进 node_modules，限数量和大小，防止扫到巨大的包） */
function listScripts(dir, depth = 0, out = []) {
    if (depth > 5 || out.length >= SCAN_MAX_FILES)
        return out;
    let names;
    try {
        names = readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const d of names) {
        if (out.length >= SCAN_MAX_FILES)
            break;
        const p = join(dir, d.name);
        if (d.isDirectory()) {
            if (d.name !== 'node_modules' && !d.name.startsWith('.'))
                listScripts(p, depth + 1, out);
        }
        else if (SCAN_EXT.test(d.name) && !d.name.endsWith('.map')) {
            try {
                if (statSync(p).size <= SCAN_MAX_BYTES)
                    out.push(p);
            }
            catch {
                // 读不到的文件跳过
            }
        }
    }
    return out;
}

/**
 * 找出工具是哪个插件注册的：DSH 的工具注册表不记来源，所以到 profile 装的每个插件包里搜工具名字面量。
 * 返回 [{ id: 包名, title, version, description, tools: [工具名] }]，按 profile 依赖顺序；找不到来源的工具不在里面。
 */
function scanPluginTools(names) {
    const profileDir = findProfileDir();
    if (!profileDir || !names.length)
        return [];
    let deps;
    try {
        deps = Object.keys(JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')).dependencies ?? {});
    }
    catch {
        return [];
    }
    const packages = [];
    for (const pkg of deps) {
        if (pkg === OWN_PACKAGE)
            continue;   // 本插件的清单里写着别人的工具名，不能算成本插件注册的
        const dir = join(profileDir, 'node_modules', ...pkg.split('/'));
        let meta;
        try {
            meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        }
        catch {
            continue;
        }
        const texts = [];
        for (const file of listScripts(dir)) {
            try {
                texts.push(readFileSync(file, 'utf8'));
            }
            catch {
                // 读不到的文件跳过
            }
        }
        packages.push({ pkg, meta, texts, found: [] });
    }
    const quoted = (name) => [`'${name}'`, `"${name}"`, `\`${name}\``];
    // 第一轮只认「name: '工具名'」「XXX_NAME = '工具名'」这种注册写法；别的插件只是在文字里提到这个工具名的，第二轮才算
    const strict = (text, name) => quoted(name).some((q) => new RegExp(`(name\\s*:|_NAME\\s*=)\\s*${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text));
    const loose = (text, name) => quoted(name).some((q) => text.includes(q));
    const remaining = new Set(names);
    for (const match of [strict, loose]) {
        for (const p of packages) {
            for (const name of [...remaining]) {
                if (p.texts.some((t) => match(t, name))) {
                    p.found.push(name);
                    remaining.delete(name);
                }
            }
        }
    }
    return packages.filter((p) => p.found.length).map(({ pkg, meta, found }) => ({
        id: pkg,
        title: pkg,
        version: typeof meta.version === 'string' ? meta.version : '',
        description: typeof meta.description === 'string' ? firstSentence(meta.description) : '',
        tools: found.sort(),
    }));
}

/** profile 里 QQ 插件那一行的配置（只读本 profile 写过的值，读不到返回 null） */
function readQqbotConfig() {
    try {
        const { entries } = readPatchEntries();
        const entry = entries.find((e) => e && typeof e === 'object' && e.id === QQBOT_ENTRY_ID);
        return entry ? (entry.config ?? {}) : null;
    }
    catch {
        return null;
    }
}

export function apply(ctx, config) {
    const logger = ctx.logger ?? console;
    const tools = ctx.get?.('tools') ?? ctx.tools;
    const allow = new Set(config.allow);

    let qqbotConfig = readQqbotConfig();
    const prefixes = () => {
        const list = [...config.cwdPrefixes];
        if (typeof qqbotConfig?.cwd === 'string' && qqbotConfig.cwd.trim())
            list.push(qqbotConfig.cwd.trim());
        return [...new Set(list.map(normalizePath))];
    };
    let cwdPrefixes = prefixes();

    const qqAgents = new WeakSet();      // 本插件认出来的 QQ 会话
    const qqSessions = new Set();        // 认出过的 QQ 会话 id：上级已经结束的子代理也能按 parentSession 认出来
    const stats = {
        loadedAt: Date.now(),
        recognized: 0,                   // 认出 QQ 会话的请求次数
        lastRecognized: null,            // { time, by }
        hidden: 0,                       // 从请求里隐藏的工具累计个数
        visible: [],                     // 最近一次 QQ 请求里模型能看到的工具
        seen: [],                        // QQ 请求里出现过的全部工具名（隐藏前）
        blocked: 0,
        rejectedApprovals: 0,
    };
    const seen = new Set();
    const log = [];                      // 拦截记录（新的在前，最多 MAX_LOG 条）
    // 累计次数：跨重启保留，清空记录时归零
    const totals = { blocked: 0, rejectedApprovals: 0, since: Date.now() };
    let fileLines = 0;
    let warnedWrite = false;

    if (config.persistLog) {
        try {
            const lines = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean) : [];
            fileLines = lines.length;
            for (const line of lines.slice(-MAX_LOG).reverse()) {
                try {
                    log.push(JSON.parse(line));
                }
                catch {
                    // 跳过写坏的行
                }
            }
            if (existsSync(TOTALS_FILE))
                Object.assign(totals, JSON.parse(readFileSync(TOTALS_FILE, 'utf8')));
        }
        catch (err) {
            logger.warn(`qqbot-permission: 读取拦截记录失败 ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    function persist(entry) {
        try {
            mkdirSync(LOG_DIR, { recursive: true });
            appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
            writeFileSync(TOTALS_FILE, JSON.stringify(totals), 'utf8');
            if (++fileLines > MAX_FILE_LINES + 500) {
                const kept = readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).slice(-MAX_FILE_LINES);
                writeFileSync(LOG_FILE, `${kept.join('\n')}\n`, 'utf8');
                fileLines = kept.length;
            }
        }
        catch (err) {
            if (!warnedWrite)
                logger.warn(`qqbot-permission: 写拦截记录失败 ${err instanceof Error ? err.message : String(err)}`);
            warnedWrite = true;
        }
    }

    /** 记一条拦截：谁（群聊昵称 / 私聊）、在哪个会话、当时说了什么 */
    function record(kind, tool, agent) {
        if (kind === 'approval')
            totals.rejectedApprovals++;
        else
            totals.blocked++;
        const entry = { time: Date.now(), kind, tool, ...whoOf(agent) };
        log.unshift(entry);
        log.length = Math.min(log.length, MAX_LOG);
        if (config.persistLog)
            persist(entry);
    }

    const remember = (agent) => {
        if (!agent || typeof agent !== 'object')
            return;
        qqAgents.add(agent);
        const id = agent.session?.header?.id ?? agent.id;
        if (typeof id === 'string')
            qqSessions.add(id);
    };
    const inCwd = (agent) => {
        const cwd = cwdOf(agent);
        return Boolean(cwd) && cwdPrefixes.some((p) => isInside(cwd, p));
    };

    /** 子代理（含 fork、工作流开出来的）：顺着会话头的 parentSession 往上找，有一级是 QQ 会话就算 */
    function fromQqParent(agent) {
        const agents = ctx.get?.('agents');
        const visited = new Set();
        let parentId = agent?.session?.header?.parentSession;
        while (typeof parentId === 'string' && !visited.has(parentId) && visited.size < 32) {
            visited.add(parentId);
            if (qqSessions.has(parentId))
                return true;
            const parent = agents?.get?.(parentId);
            if (!parent)
                return false;
            if (qqAgents.has(parent) || inCwd(parent))
                return true;
            parentId = parent.session?.header?.parentSession;
        }
        return false;
    }

    /** 会话里最近一条 QQ 用户发来的消息正文（往回最多看 400 条事件；DSH 改了会话接口就返回 ''） */
    function lastUserText(agent) {
        try {
            const session = agent?.session;
            for (let seq = Number(session.seq) - 1, n = 0; seq >= 0 && n < 400; seq--, n++) {
                const event = session.eventAt(seq);
                if (event?.type === 'user/message' && event.data?.source?.kind === 'user')
                    return (event.data.content ?? []).filter((p) => p?.type === 'text').map((p) => p.text).join('\n');
            }
        }
        catch {
            // 读不到就不记原话
        }
        return '';
    }

    /** 拦截记录里的「谁」：子代理往上找到最顶上的 QQ 会话，读它最近一条用户消息 */
    function whoOf(agent) {
        const agents = ctx.get?.('agents');
        let root = agent;
        for (let depth = 0; depth < 32; depth++) {
            const parentId = root?.session?.header?.parentSession;
            const parent = typeof parentId === 'string' ? agents?.get?.(parentId) : undefined;
            if (!parent || !isQq(parent))
                break;
            root = parent;
        }
        const id = root?.session?.header?.id ?? root?.id;
        const who = parseQqUserText(lastUserText(root)) ?? {};
        return { ...(typeof id === 'string' ? { session: id } : {}), ...who };
    }

    /** 返回识别依据（'prompt' / 'cwd' / 'parent'），不是 QQ 会话返回 '' */
    function detect(agent, sections) {
        if (sections?.some((s) => s?.name === QQBOT_SECTION))
            return 'prompt';
        if (inCwd(agent))
            return 'cwd';
        if (fromQqParent(agent))
            return 'parent';
        return '';
    }
    const isQq = (agent) => {
        if (qqAgents.has(agent))
            return true;
        if (!detect(agent))
            return false;
        remember(agent);
        return true;
    };

    const noticeText = () => {
        const names = [...allow];
        if (!names.length)
            return DEFAULT_NOTICE_NONE;
        return fill(config.notice.text || DEFAULT_NOTICE, { tools: names.join('、') });
    };

    // 1. 执行时拦截：硬边界
    if (typeof tools?.guard === 'function') {
        const dispose = tools.guard((exec) => {
            if (!config.enabled || !exec?.agent || !isQq(exec.agent))
                return undefined;
            if (!allow.has(exec.name)) {
                stats.blocked++;
                record('call', exec.name, exec.agent);
                logger.info(`qqbot-permission: 已拦截 QQ 会话调用 ${exec.name}`);
                return fill(config.denyMessage || DEFAULT_DENY, { tool: exec.name });
            }
            if (exec.name === 'web_fetch' && config.webFetchPublicOnly) {
                const url = String(exec.arguments?.url ?? '');
                const reason = nonPublicUrl(url);
                if (reason) {
                    stats.blocked++;
                    record('fetch', url.slice(0, 200), exec.agent);
                    logger.info(`qqbot-permission: 已拦截 QQ 会话打开 ${url.slice(0, 200)}（${reason}）`);
                    return `QQ 里的 web_fetch 只能打开公网网址，这个网址不行（${reason}）。不要换写法重试，直接告诉对方这个打不开。`;
                }
            }
            return undefined;
        });
        if (typeof dispose === 'function')
            ctx.on?.('dispose', dispose);
    }
    else {
        logger.warn('qqbot-permission: tools 服务没有 guard()，只能在请求里隐藏工具，无法在执行时拦截');
    }

    // 2. 请求里隐藏 + 权限说明。prepend 后先调用 next()，才能看到 qqbot 追加的 qqbot:scope-prompt
    ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
        const assembled = await next();
        try {
            const agent = context?.agent;
            const by = detect(agent, assembled?.sections);
            if (!by)
                return assembled;
            remember(agent);
            stats.recognized++;
            stats.lastRecognized = { time: Date.now(), by };
            if (!config.enabled)
                return assembled;
            const before = Array.isArray(assembled?.tools) ? assembled.tools : [];
            for (const t of before)
                if (t?.name)
                    seen.add(t.name);
            stats.seen = [...seen].sort();
            let result = assembled;
            if (config.hideTools) {
                const kept = before.filter((t) => allow.has(t?.name));
                stats.hidden += before.length - kept.length;
                result = { ...result, tools: kept };
            }
            stats.visible = (result.tools ?? []).map((t) => t?.name).filter(Boolean);
            if (config.notice.enabled) {
                const sections = (result.sections ?? []).filter((s) => s?.name !== NOTICE_SECTION);
                sections.push({ name: NOTICE_SECTION, order: 96, text: noticeText() });
                result = { ...result, sections };
            }
            return result;
        }
        catch (err) {
            logger.warn(`qqbot-permission: 处理请求时出错 ${err instanceof Error ? err.message : String(err)}`);
            return assembled;
        }
    }, { prepend: true });

    // 3. 拒绝越权审批。approval/request 按 agent 作用域派发，根作用域监听要带 global 才收得到
    ctx.on('approval/request', (request, next) => {
        try {
            if (config.enabled && config.rejectApprovals && request?.agent && isQq(request.agent)) {
                stats.rejectedApprovals++;
                record('approval', request.tool ?? request.toolName ?? '', request.agent);
                logger.info('qqbot-permission: 已拒绝 QQ 会话的越权审批请求');
                return 'rejected';
            }
        }
        catch {
            // 出错就走正常审批流程
        }
        return next();
    }, { global: true, prepend: true });

    // ---------- 设置页接口 ----------

    /** dsh 里实际注册的全局工具：名字 → 描述（读不到时返回 null） */
    function registeredTools() {
        try {
            const schemas = tools?.schemas?.();
            if (!Array.isArray(schemas))
                return null;
            return new Map(schemas.filter((s) => s?.name).map((s) => [s.name, typeof s.description === 'string' ? s.description : '']));
        }
        catch {
            return null;
        }
    }

    /**
     * 设置页的工具清单：DSH 自带工具按 GROUPS 分组；其余按「哪个插件注册的」分组，MCP 工具按服务器分组，找不到来源的放进 others。
     * 扫描插件包比较慢，按工具名集合缓存。
     */
    let pluginCache = { key: '', plugins: [] };
    function buildCatalog(registered) {
        const descOf = (name) => KNOWN_PLUGIN_TOOLS[name]?.desc ?? firstSentence(registered?.get(name));
        const live = [...new Set([...(registered?.keys() ?? []), ...seen, ...allow])].sort();
        const rest = live.filter((n) => !BUILTIN_NAMES.has(n));
        const mcp = new Map();
        const unscanned = [];
        for (const name of rest) {
            const m = /^mcp__(.+?)__/.exec(name);
            if (m)
                (mcp.get(m[1]) ?? mcp.set(m[1], []).get(m[1])).push(name);
            else
                unscanned.push(name);
        }
        const key = unscanned.join(',');
        if (pluginCache.key !== key)
            pluginCache = { key, plugins: scanPluginTools(unscanned) };
        const owned = new Set(pluginCache.plugins.flatMap((p) => p.tools));
        const toolOf = (name) => ({ name, ...KNOWN_PLUGIN_TOOLS[name], desc: descOf(name) });
        const plugins = [
            ...pluginCache.plugins.map((p) => ({ ...p, kind: 'plugin', tools: p.tools.map(toolOf) })),
            ...[...mcp].map(([server, names]) => ({ id: `mcp:${server}`, kind: 'mcp', title: `MCP：${server}`, version: '', description: '', tools: names.map(toolOf) })),
        ];
        return {
            groups: GROUPS,
            presets: PRESETS,
            plugins,
            others: unscanned.filter((n) => !owned.has(n)).map(toolOf),
        };
    }

    /** QQ 插件配置里和安全有关的几项，给设置页显示「识别状态」和建议 */
    function qqbotHealth() {
        if (!qqbotConfig)
            return { found: false };
        const access = qqbotConfig.access ?? {};
        return {
            found: true,
            cwd: typeof qqbotConfig.cwd === 'string' ? qqbotConfig.cwd : '',
            groupPrompt: Boolean(qqbotConfig.groupPrompt?.trim?.()),
            directPrompt: Boolean(qqbotConfig.directPrompt?.trim?.()),
            groupMode: access.groupMode ?? 'open',
            c2cMode: access.c2cMode ?? 'open',
        };
    }

    const sendJson = (res, code, body) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
    };

    /** 最小 CSRF 防护：带 Origin 的请求必须同源（Desktop IPC 桥不带 Origin，放行） */
    function sameOrigin(req) {
        const origin = req.headers.origin;
        if (origin === undefined)
            return true;
        try {
            return new URL(origin).host === req.headers.host;
        }
        catch {
            return false;
        }
    }

    function readBody(req) {
        return new Promise((resolveBody, reject) => {
            const chunks = [];
            let size = 0;
            req.on('data', (chunk) => {
                size += chunk.length;
                if (size > MAX_BODY) {
                    reject(new Error('请求体过大'));
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });
    }

    async function handleStatus(req, res) {
        if (!sameOrigin(req))
            return sendJson(res, 403, { error: 'forbidden' });
        if (req.method !== 'GET')
            return sendJson(res, 405, { error: 'method not allowed' });
        qqbotConfig = readQqbotConfig();
        cwdPrefixes = prefixes();
        const registered = registeredTools();
        sendJson(res, 200, {
            enabled: config.enabled,
            guardAvailable: typeof tools?.guard === 'function',
            allow: [...allow],
            cwdPrefixes,
            qqbot: qqbotHealth(),
            qqWorkspace: QQ_WORKSPACE,
            stats,
            totals,
            logFile: config.persistLog ? LOG_FILE : null,
            logDir: LOG_DIR,
            log,
            registered: registered ? [...registered.keys()].sort() : null,
            catalog: buildCatalog(registered),
        });
    }

    async function handleConfig(req, res) {
        if (!sameOrigin(req))
            return sendJson(res, 403, { error: 'forbidden' });
        if (req.method === 'GET')
            return sendJson(res, 200, { config, defaults: { notice: DEFAULT_NOTICE, denyMessage: DEFAULT_DENY, allow: DEFAULT_ALLOW } });
        if (req.method !== 'POST')
            return sendJson(res, 405, { error: 'method not allowed' });
        let patch;
        try {
            patch = JSON.parse(await readBody(req)).patch;
        }
        catch (err) {
            return sendJson(res, 400, { ok: false, error: `请求格式不对：${err instanceof Error ? err.message : String(err)}` });
        }
        if (!patch || typeof patch !== 'object' || Array.isArray(patch))
            return sendJson(res, 400, { ok: false, error: '缺少 patch' });
        const allowedKeys = new Set(Object.keys(Config.dict ?? config));
        const clean = {};
        for (const [key, value] of Object.entries(patch)) {
            if (!allowedKeys.has(key))
                return sendJson(res, 400, { ok: false, error: `不认识的配置项：${key}` });
            clean[key] = typeof value === 'string' ? value.trim() : value;
        }
        if (clean.allow !== undefined) {
            if (!Array.isArray(clean.allow))
                return sendJson(res, 400, { ok: false, error: '白名单必须是工具名列表' });
            clean.allow = [...new Set(clean.allow.map((n) => String(n).trim()).filter(Boolean))];
            const bad = clean.allow.find((n) => !/^[\w.-]{1,80}$/.test(n));
            if (bad)
                return sendJson(res, 400, { ok: false, error: `工具名格式不对：${bad}` });
        }
        if (clean.cwdPrefixes !== undefined) {
            clean.cwdPrefixes = (clean.cwdPrefixes ?? []).map((p) => String(p).trim()).filter(Boolean);
            const relative = clean.cwdPrefixes.find((p) => !/^([a-zA-Z]:[\\/]|\/|~)/.test(p));
            if (relative)
                return sendJson(res, 400, { ok: false, error: `工作目录要写完整路径：${relative}` });
        }
        try {
            Config({ ...config, ...clean });   // 类型校验：不合法直接报错，不写文件
        }
        catch (err) {
            return sendJson(res, 400, { ok: false, error: `配置不合法：${err instanceof Error ? err.message : String(err)}` });
        }
        if (!Object.keys(clean).length)
            return sendJson(res, 200, { ok: true, message: '没有需要保存的修改' });
        try {
            const file = persistEntry(name, clean);
            logger.info(`qqbot-permission: 配置已保存到 ${file}（${Object.keys(clean).join(', ')}），插件将自动重载`);
        }
        catch (err) {
            return sendJson(res, 500, { ok: false, error: `保存失败：${err instanceof Error ? err.message : String(err)}` });
        }
        return sendJson(res, 200, { ok: true, message: '已保存，插件正在重新加载' });
    }

    /** 给 QQ 插件设一个专用的空工作目录（固定路径，不接受参数）：写入 im-qqbot 的 cwd，QQ 插件会重新加载 */
    async function handleWorkspace(req, res) {
        if (!sameOrigin(req))
            return sendJson(res, 403, { error: 'forbidden' });
        if (req.method !== 'POST')
            return sendJson(res, 405, { error: 'method not allowed' });
        try {
            mkdirSync(QQ_WORKSPACE, { recursive: true });
            const file = persistEntry(QQBOT_ENTRY_ID, { cwd: QQ_WORKSPACE });
            qqbotConfig = readQqbotConfig();
            cwdPrefixes = prefixes();
            logger.info(`qqbot-permission: 已把 QQ 机器人的工作目录设为 ${QQ_WORKSPACE}（${file}）`);
        }
        catch (err) {
            return sendJson(res, 500, { ok: false, error: `设置失败：${err instanceof Error ? err.message : String(err)}` });
        }
        return sendJson(res, 200, { ok: true, message: `已设为 ${QQ_WORKSPACE}，QQ 机器人插件正在重新加载`, dir: QQ_WORKSPACE });
    }

    /** 在文件管理器里打开一个识别用的工作目录：只接受当前 cwdPrefixes 里的目录，不能借它打开任意路径 */
    async function handleOpenDir(req, res) {
        if (!sameOrigin(req))
            return sendJson(res, 403, { error: 'forbidden' });
        if (req.method !== 'POST')
            return sendJson(res, 405, { error: 'method not allowed' });
        let dir;
        try {
            dir = JSON.parse(await readBody(req)).dir;
        }
        catch (err) {
            return sendJson(res, 400, { ok: false, error: `请求格式不对：${err instanceof Error ? err.message : String(err)}` });
        }
        if (typeof dir !== 'string' || ![...cwdPrefixes, normalizePath(LOG_DIR)].includes(normalizePath(dir)))
            return sendJson(res, 400, { ok: false, error: '只能打开识别 QQ 会话用的工作目录或拦截记录所在目录' });
        const target = resolve(dir);
        if (!existsSync(target) || !statSync(target).isDirectory())
            return sendJson(res, 404, { ok: false, error: `目录不存在：${target}` });
        const opener = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        try {
            // explorer.exe 成功时也会返回非零退出码，所以不看结果，只管启动
            const child = spawn(opener, [target], { detached: true, stdio: 'ignore', windowsHide: false });
            child.on('error', (err) => logger.warn(`qqbot-permission: 打开目录失败 ${err.message}`));
            child.unref();
        }
        catch (err) {
            return sendJson(res, 500, { ok: false, error: `打开失败：${err instanceof Error ? err.message : String(err)}` });
        }
        return sendJson(res, 200, { ok: true, message: `已打开 ${target}` });
    }

    /** 清空拦截记录：内存里的、记录文件、累计次数一起清 */
    async function handleClearLog(req, res) {
        if (!sameOrigin(req))
            return sendJson(res, 403, { error: 'forbidden' });
        if (req.method !== 'POST')
            return sendJson(res, 405, { error: 'method not allowed' });
        log.length = 0;
        Object.assign(totals, { blocked: 0, rejectedApprovals: 0, since: Date.now() });
        stats.blocked = 0;
        stats.rejectedApprovals = 0;
        try {
            if (existsSync(LOG_FILE))
                writeFileSync(LOG_FILE, '', 'utf8');
            if (existsSync(TOTALS_FILE))
                writeFileSync(TOTALS_FILE, JSON.stringify(totals), 'utf8');
            fileLines = 0;
        }
        catch (err) {
            return sendJson(res, 500, { ok: false, error: `清空失败：${err instanceof Error ? err.message : String(err)}` });
        }
        logger.info('qqbot-permission: 已清空拦截记录');
        return sendJson(res, 200, { ok: true, message: '已清空拦截记录' });
    }

    const routeHandler = (handle) => (req, res) => {
        handle(req, res).catch((err) => {
            logger.warn(`qqbot-permission: 面板接口出错 ${err instanceof Error ? err.message : String(err)}`);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end();
            }
        });
    };
    ctx.inject?.(['webServer'], (scoped) => {
        const webServer = scoped.webServer;
        if (typeof webServer?.register !== 'function')
            return;
        const disposers = [
            webServer.register({ kind: 'exact', path: STATUS_PATH, handler: routeHandler(handleStatus) }),
            webServer.register({ kind: 'exact', path: CONFIG_PATH, handler: routeHandler(handleConfig) }),
            webServer.register({ kind: 'exact', path: WORKSPACE_PATH, handler: routeHandler(handleWorkspace) }),
            webServer.register({ kind: 'exact', path: OPEN_DIR_PATH, handler: routeHandler(handleOpenDir) }),
            webServer.register({ kind: 'exact', path: CLEAR_LOG_PATH, handler: routeHandler(handleClearLog) }),
        ];
        scoped.effect?.(() => () => { for (const d of disposers) d?.(); }, 'qqbot-permission.panel-routes');
    });

    const health = qqbotHealth();
    if (!health.found)
        logger.warn('qqbot-permission: profile 里没找到 QQ 机器人插件（im-qqbot）的配置');
    else if (!cwdPrefixes.length && !(health.groupPrompt && health.directPrompt))
        logger.warn('qqbot-permission: QQ 插件没设专用工作目录，群聊 / 私聊额外提示词也不全，部分 QQ 会话可能认不出来。请在设置页「QQ机器人权限」里点「设为专用目录」');
    logger.info(`qqbot-permission: 已加载（${config.enabled ? '已启用' : '已关闭'}），白名单 ${[...allow].join(', ') || '（空：只能聊天）'}`);
}
