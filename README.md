# dsh-qqbot-permission：QQ机器人权限

DeepSeek Harness（DSH）插件，配合 QQ 机器人插件 [`@tencent-connect/dsh-qqbot`](https://github.com/tencent-connect/dsh-qqbot) 使用。

QQ 机器人默认和你在桌面版里用的 AI 拥有**同样的工具**：执行 PowerShell、读写文件、翻历史会话……群里任何人 @ 它都能用。
装上本插件后，**QQ 机器人只能用白名单里的工具**，其余一律拦截；桌面版自己的会话不受影响。
在设置页「QQ机器人权限」里按分组勾选常用权限即可，不用手写配置。

## 它做了什么

| 层 | 做法 | 作用 |
|---|---|---|
| 执行时拦截 | `ctx.tools.guard` | QQ 会话调用白名单以外的工具直接拒绝。这是硬边界：模型就算自己编出工具名去调也会被挡住 |
| 请求里隐藏 | `system-prompt/assemble` | 白名单以外的工具不发给模型（看不到就不会去试，也省 token），并追加一段说明告诉它在 QQ 里能做什么 |
| 拒绝越权审批 | `approval/request` | QQ 插件会把「✅ 允许一次 / ❌ 拒绝」按钮发到群里，**群里任何人都能点**；本插件直接拒绝 QQ 会话的审批请求 |
| `web_fetch` 只许公网 | `ctx.tools.guard` 检查网址 | 放行了「读取网页」时，`localhost`、`127.0.0.1`、`192.168.x.x`、局域网主机名等一律拦截，群友没法借机器人探本机和内网 |

QQ 会话开出来的子代理（`subagent`、fork、工作流）也按 QQ 会话限制。

## 安装

### 从 GitHub 安装（推荐）

DSH 桌面版：**插件 → 添加插件 → 安装第三方插件**，填：

```
github:ChaoYang-PengYuYan/dsh-qqbot-permission
```

也可以填 `git+https://github.com/ChaoYang-PengYuYan/dsh-qqbot-permission.git`。网页地址 `https://github.com/...` 不是合法的包地址，装不上。

装好后它会出现在「插件」页的已安装列表里，可以启停、卸载。

命令行 profile（桌面版独占的 `desktop` profile 会拒绝命令行操作，请用上面的界面）：

```
dsh plugin --profile <profile 名> add github:ChaoYang-PengYuYan/dsh-qqbot-permission
```

### 从本地安装

在仓库目录运行 `npm pack` 得到 `dsh-qqbot-permission-<版本>.tgz`，在「安装第三方插件」里填它的完整路径。
**装好后不要删除或移动这个 `.tgz`**：DSH 记录的是它的路径，以后安装、升级其他插件时还会用到。

## 装好后做三件事

打开 **设置 →「QQ机器人权限」**：

1. **看「怎么认出 QQ 会话」**：如果「工作目录」一行是 ✗，点「**设为专用目录**」。它会把 QQ 插件的工作目录设成 `~/.dsh-qqbot/workspace`（一个空文件夹），这样既能稳定认出 QQ 会话，沙箱的写入边界也会落在这个空文件夹里。QQ 插件会自动重新加载。设好后目录旁的「打开」按钮可以在文件管理器里看 QQ 机器人生成的文件。
2. **勾选 QQ 机器人能用的工具**，或者点上面的一键组合，然后点「保存配置」。
3. 在 QQ 里 @ 机器人说一句话，回到设置页点「刷新」，看「运行情况」里的「AI 能看到的工具」是不是你勾的那些。

另外建议在 QQ 机器人插件的设置里把群聊 / 私聊访问改成**白名单**：本插件管的是"能做什么"，QQ 插件的白名单管的是"谁能用"。

## 权限清单

设置页分两部分列出工具，勾上的才能用。每个分组默认收起，标题旁显示放行了几个（如「放行 1/2」），点标题展开。

### DSH 自带的工具

按分组列出，标了风险等级；这台电脑上没有的工具会标「这台电脑上没装」。

| 分组 | 工具 | 风险 | 说明 |
|---|---|---|---|
| 联网 | `web_search` | 安全 | 联网搜索 |
| | `web_fetch` | 谨慎 | 打开网址读内容；本机和内网地址默认会被拦（见下方「`web_fetch` 只许公网」） |
| 对话辅助 | `ask_user_question` `todo_write` | 安全 | 发带按钮的选择题；会话内的待办清单 |
| | `skill` | 谨慎 | 读取已安装技能的说明 |
| 读取本机文件 | `read` `read_image` `glob` `grep` `present` | 谨慎 | Windows 上读取**不受沙箱限制**：能读出密钥、配置文件，再用文字发到群里 |
| 历史会话和 MCP 资源 | `session_*` `*_mcp_resource*` | 谨慎 | 能翻到你在桌面版里的其他对话 |
| 执行命令 | `pwsh` `bash` `job_*` `terminal_*` `load_workspace_dependencies` | 危险 | 在这台电脑上执行任意命令 |
| 修改文件 | `write` `edit` `str_replace_editor` `apply_patch` `working_directory` | 危险 | 创建、覆盖、修改文件；切换工作目录 |
| 子代理和自动化 | `subagent` `workflow` `spawn_teammate` `schedule_*` `*_goal` `plugin_manager` | 危险 | 子代理会继承 QQ 限制，但会多花 token、并发跑；定时任务会在没人看着时运行；插件管理能装任意代码 |

### 已安装的插件

本插件会找出这台电脑上装的每个插件注册了哪些工具，按插件分组列出。标题旁的勾选框可以**整组放行或禁止**，也可以单独勾某个工具。

- QQ 机器人插件自带的 `qqbot_send_file`（发文件 / 图片）、`qqbot_describe_image`（看图）带中文说明和风险等级
- 其他插件的工具，说明取工具自己的描述
- MCP 工具按 MCP 服务器分组
- 找不到是哪个插件注册的工具，放在「其他工具」里

比如装了画图插件，它会单独列成一组；想让群友画图，就把这一组整组放行（画好的图要靠 `qqbot_send_file` 发出去，记得一起放行）。

> DSH 的工具注册表不记录"这个工具是哪个插件注册的"，所以本插件是到 profile 里装的每个插件包里搜工具名来判断的。
> 优先认 `name: '工具名'` 这种注册写法；只是在文字里提到别人工具名的插件不会被算成来源。

### 一键组合

只用 DSH 和 QQ 插件自带的工具；其他插件的工具在「已安装的插件」里按插件勾选。

| 组合 | 白名单 |
|---|---|
| 只聊天 | （空） |
| **推荐**（默认） | `qqbot_describe_image` `qqbot_send_file` `web_search` |
| 推荐 + 读网页 | 再加 `web_fetch` |

## 怎么认出 QQ 会话

任一条命中就算 QQ 会话：

- **提示词**：QQ 插件每轮都会给自己的会话加一段 `qqbot:scope-prompt`。前提是在 QQ 插件里**填了**群聊 / 私聊额外提示词；哪个是空的，那一类会话就认不出来。
- **工作目录**：会话的工作目录在 QQ 插件的 `cwd`（或本插件「额外按工作目录识别」里填的目录）下面。点设置页的「设为专用目录」就能设好。
- **上级会话**：子代理的会话记着自己的上级（`parentSession`），顺着往上找，有一级是 QQ 会话就算。子代理还会继承上级的工作目录，所以设了专用目录时也能靠工作目录认出来。

都不满足时，QQ 会话会被当成普通会话放行。设置页「怎么认出 QQ 会话」会逐项标出 ✓ / ✗，升级 DSH 或 QQ 插件后请看一眼。

## 配置

都可以在设置页改；保存后写入 profile 的 `cordis.patch.yml`，插件自动重新加载。手动写的话：

```yaml
- id: qqbot-permission
  config:
    enabled: true                  # 总开关
    allow:                         # 白名单
      - qqbot_describe_image
      - qqbot_send_file
      - web_search
    hideTools: true                # 白名单以外的工具不发给模型
    rejectApprovals: true          # 拒绝 QQ 会话的越权审批
    webFetchPublicOnly: true       # QQ 会话的 web_fetch 只许打开公网网址
    notice:
      enabled: true                # 告诉 AI 它能用哪些工具
      text: '……{tools}……'
    denyMessage: '……{tool}……'      # 拦截时回给 AI 的话
    cwdPrefixes: []                # 额外按工作目录识别（QQ 插件的 cwd 会自动加上）
```

## 已知限制

- **不是操作系统沙箱**：拦的是 DSH 的工具调用。白名单里的工具能做的事，它照样能做。
- **`web_fetch` 只看网址本身**：拦得住 IP 和局域网主机名，但不做 DNS 解析，一个公网域名如果解析到内网地址，本插件看不出来。这种情况由 DSH 自带的 `web_fetch` 在连接前检查（它只连公网地址）；**配了 HTTP 代理时 DSH 会跳过这项检查**，交给代理去解析域名。
- **子代理**：重启 DSH 后，冷恢复的子代理如果上级会话已经不在线，只能靠工作目录认出来。所以建议设好专用目录。
- **PTC 模式**：DSH 的工具模式设成 `ptc` 时，模型通过 `run_code` 调工具；`run_code` 不在白名单里会被拦，QQ 机器人就用不了任何工具。默认的 `native` 模式没有这个问题。
- **桌面会话开在 QQ 专用目录里**，也会被当成 QQ 会话限制。

## 参考

思路参考了 [Chr1sut1na/dsh-qqbot-guard](https://github.com/Chr1sut1na/dsh-qqbot-guard)（在 `system-prompt/assemble` 里认出 QQ 会话并隐藏工具）。本插件在此基础上加了执行时拦截、子代理继承限制、`web_fetch` 公网限制，修正了审批监听（`approval/request` 按 agent 作用域派发，根作用域监听要带 `global: true` 才收得到），并把权限做成分组勾选。

## 卸载

「插件」页里卸载即可。手动装的：删掉 `cordis.patch.yml` 里 `qqbot-permission` 那几行。

## License

MIT
