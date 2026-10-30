/**
 * 工具清单：设置页按分组列出，勾选即放行。
 *
 * 这里只写 DSH 自带的工具和 QQ 机器人插件（@tencent-connect/dsh-qqbot）自带的工具。
 * 其他插件注册的工具由服务端在运行时找出来源（见 index.js 的 scanPluginTools），按插件分组列出，不写死在这里。
 *
 * risk：safe = 可以放心给群友用；caution = 会碰到本机数据或内网，按需开放；danger = 能改动这台电脑，不要开放。
 */
export const GROUPS = [
    {
        id: 'web',
        title: '联网',
        tools: [
            { name: 'web_search', label: '联网搜索', risk: 'safe', desc: '搜索引擎查资料' },
            { name: 'web_fetch', label: '读取网页', risk: 'caution', desc: '打开网址读内容；本机、内网地址会被拦（「其他选项」里的「web_fetch 只许打开公网网址」）' },
        ],
    },
    {
        id: 'chat',
        title: '对话辅助',
        tools: [
            { name: 'ask_user_question', label: '向用户提问', risk: 'safe', desc: '发带按钮的选择题，等对方回答（QQ 里显示成按钮）' },
            { name: 'todo_write', label: '待办清单', risk: 'safe', desc: '在会话里记步骤清单，不碰文件' },
            { name: 'exit_plan_mode', label: '退出计划模式', risk: 'safe', desc: '计划模式下提交计划' },
            { name: 'skill', label: '加载技能', risk: 'caution', desc: '读取已安装技能的说明；技能里可能写着让它执行命令（命令本身仍受这里的权限限制）' },
        ],
    },
    {
        id: 'read',
        title: '读取本机文件',
        tools: [
            { name: 'read', label: '读文件', risk: 'caution', desc: 'Windows 上读取不受沙箱限制：能读到密钥、配置、聊天记录等任何文件，再用文字发出去' },
            { name: 'read_file', label: '读文件（兼容名）', risk: 'caution', desc: '同上' },
            { name: 'read_image', label: '读本机图片', risk: 'caution', desc: '读取电脑上的图片文件' },
            { name: 'glob', label: '按文件名查找', risk: 'caution', desc: '列出目录、搜文件名，能看到电脑上有哪些文件' },
            { name: 'grep', label: '搜索文件内容', risk: 'caution', desc: '在文件里搜关键字，能翻出密码、密钥' },
            { name: 'present', label: '交付文件', risk: 'caution', desc: '把文件作为结果交付；QQ 插件会把它发到当前会话' },
        ],
    },
    {
        id: 'history',
        title: '历史会话和 MCP 资源',
        tools: [
            { name: 'session_search', label: '搜索历史会话', risk: 'caution', desc: '能翻到你在桌面版里的其他对话内容' },
            { name: 'session_trace', label: '查看会话轨迹', risk: 'caution', desc: '同上' },
            { name: 'session_event_read', label: '读取会话事件', risk: 'caution', desc: '同上' },
            { name: 'session_event_search', label: '搜索会话事件', risk: 'caution', desc: '同上' },
            { name: 'session_event_trace', label: '追踪会话事件', risk: 'caution', desc: '同上' },
            { name: 'list_mcp_resources', label: '列出 MCP 资源', risk: 'caution', desc: '查看已连接的 MCP 服务提供的资源' },
            { name: 'list_mcp_resource_templates', label: '列出 MCP 资源模板', risk: 'caution', desc: '同上' },
            { name: 'read_mcp_resource', label: '读取 MCP 资源', risk: 'caution', desc: '读取 MCP 服务里的数据' },
        ],
    },
    {
        id: 'shell',
        title: '执行命令',
        tools: [
            { name: 'pwsh', label: 'PowerShell', risk: 'danger', desc: '在这台电脑上执行任意命令' },
            { name: 'bash', label: 'Bash', risk: 'danger', desc: '同上（Linux / macOS）' },
            { name: 'job_list', label: '后台任务列表', risk: 'danger', desc: '查看后台运行的命令' },
            { name: 'job_output', label: '后台任务输出', risk: 'danger', desc: '读取后台命令的输出' },
            { name: 'job_kill', label: '结束后台任务', risk: 'danger', desc: '结束后台命令' },
            { name: 'terminal_open', label: '打开终端', risk: 'danger', desc: '开一个交互终端' },
            { name: 'terminal_send', label: '向终端输入', risk: 'danger', desc: '在终端里打字执行' },
            { name: 'terminal_read', label: '读取终端', risk: 'danger', desc: '读终端输出' },
            { name: 'terminal_list', label: '终端列表', risk: 'danger', desc: '列出打开的终端' },
            { name: 'terminal_signal', label: '终端信号', risk: 'danger', desc: '给终端发中断等信号' },
            { name: 'terminal_close', label: '关闭终端', risk: 'danger', desc: '关闭终端' },
            { name: 'load_workspace_dependencies', label: '安装工作区依赖', risk: 'danger', desc: '给工作目录装依赖，可能运行安装脚本' },
        ],
    },
    {
        id: 'write',
        title: '修改文件',
        tools: [
            { name: 'write', label: '写文件', risk: 'danger', desc: '创建或覆盖文件' },
            { name: 'edit', label: '编辑文件', risk: 'danger', desc: '修改文件内容' },
            { name: 'edit_file', label: '编辑文件（兼容名）', risk: 'danger', desc: '同上' },
            { name: 'str_replace_editor', label: '编辑器', risk: 'danger', desc: '查看、修改文件' },
            { name: 'apply_patch', label: '打补丁', risk: 'danger', desc: '批量修改文件' },
            { name: 'working_directory', label: '切换工作目录', risk: 'danger', desc: '换到别的目录干活，沙箱写入边界会跟着变' },
            { name: 'create_worktree', label: '创建 git 工作区', risk: 'danger', desc: '在仓库里建新的 worktree' },
        ],
    },
    {
        id: 'agents',
        title: '子代理和自动化',
        tools: [
            { name: 'subagent', label: '派子代理', risk: 'danger', desc: '开新的 AI 会话替它干活；子代理不一定被认成 QQ 会话，会绕过本插件' },
            { name: 'subagent_fork', label: '分叉子代理', risk: 'danger', desc: '同上' },
            { name: 'agent', label: '派子代理（兼容名）', risk: 'danger', desc: '同上' },
            { name: 'workflow', label: '工作流', risk: 'danger', desc: '一次编排多个子代理' },
            { name: 'spawn_teammate', label: '派队友', risk: 'danger', desc: '同上' },
            { name: 'send_message', label: '给子代理发消息', risk: 'danger', desc: '指挥子代理' },
            { name: 'wait_agent', label: '等待子代理', risk: 'danger', desc: '等子代理完成' },
            { name: 'list_agents', label: '子代理列表', risk: 'danger', desc: '查看子代理' },
            { name: 'interrupt_agent', label: '打断子代理', risk: 'danger', desc: '中断子代理' },
            { name: 'team_task_create', label: '团队任务', risk: 'danger', desc: '创建团队任务（team_task_* 一组）' },
            { name: 'team_task_get', label: '团队任务查询', risk: 'danger', desc: '同上' },
            { name: 'team_task_list', label: '团队任务列表', risk: 'danger', desc: '同上' },
            { name: 'team_task_update', label: '团队任务更新', risk: 'danger', desc: '同上' },
            { name: 'schedule_create', label: '创建定时任务', risk: 'danger', desc: '之后会在没人看着的时候自动运行' },
            { name: 'schedule_update', label: '修改定时任务', risk: 'danger', desc: '同上' },
            { name: 'schedule_list', label: '定时任务列表', risk: 'danger', desc: '查看定时任务' },
            { name: 'schedule_delete', label: '删除定时任务', risk: 'danger', desc: '删掉定时任务' },
            { name: 'create_goal', label: '长期目标', risk: 'danger', desc: '让它持续自动干活（*_goal 一组）' },
            { name: 'get_goal', label: '查看目标', risk: 'danger', desc: '同上' },
            { name: 'update_goal', label: '修改目标', risk: 'danger', desc: '同上' },
            { name: 'plugin_manager', label: '插件管理', risk: 'danger', desc: '安装 / 卸载 dsh 插件，能装任意代码' },
        ],
    },
];

/** QQ 机器人插件自带的工具：它在「已安装的插件」里按插件列出，这里只补中文说明和风险等级 */
export const QQBOT_PACKAGE = '@tencent-connect/dsh-qqbot';
export const KNOWN_PLUGIN_TOOLS = {
    qqbot_send_file: { label: '发送文件 / 图片', risk: 'safe', desc: '把文件发到当前 QQ 会话。QQ 插件只允许发它的媒体目录和工作目录里的文件；其他插件生成图片、文件后要靠它发出去' },
    qqbot_describe_image: { label: '看图', risk: 'safe', desc: '理解群友发来的图片（需要在 QQ 插件里开启视觉理解）' },
};

/** 一键套用的常用组合：只用 DSH 和 QQ 插件自带的工具；其他插件的工具在「已安装的插件」里按插件勾选 */
export const PRESETS = [
    { id: 'none', label: '只聊天', desc: '不给任何工具', allow: [] },
    { id: 'recommended', label: '推荐', desc: '看图、发文件、联网搜索', allow: ['qqbot_describe_image', 'qqbot_send_file', 'web_search'] },
    { id: 'web', label: '推荐 + 读网页', desc: '再加上打开网址读内容', allow: ['qqbot_describe_image', 'qqbot_send_file', 'web_search', 'web_fetch'] },
];

export const DEFAULT_ALLOW = PRESETS.find((p) => p.id === 'recommended').allow;

export const BUILTIN_NAMES = new Set(GROUPS.flatMap((g) => g.tools.map((t) => t.name)));
