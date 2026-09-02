# dsh-skill-router

DSH 插件：**skills 管理 + 自动路由** —— 管理 `~/.dsh/skills` 下的 skill，并在对话中自动匹配、加载最合适的 skill。

## 功能

- **自动匹配**：提供 `recommend_skill(task)` 工具，按当前任务描述匹配最合适的 skill 并返回其完整说明；同时注入系统提示，引导 Agent 在新任务开始时先调用它。
- **管理界面**：在 DSH 设置页新增「Skills 管理」页面，可：
  - 列出 `~/.dsh/skills` 下的所有 skill
  - 查看某个 skill 的完整内容
  - 编辑某个 skill（原始 `SKILL.md` 内容编辑，保留 frontmatter 与正文）
  - 新建 skill（名称 + 描述 + 正文，自动生成 `SKILL.md`）
  - 删除 skill
- **存储位置**：skill 以 `<name>/SKILL.md` 的形式存放在 `~/.dsh/skills`（YAML frontmatter：`name` / `description` / `whenToUse` + 正文）。

## 安装

```sh
# 本地源码
dsh plugin --profile desktop add ./dsh-skill-router

# 或从 npm / GitHub 安装
dsh plugin --profile desktop add dsh-skill-router@latest
```

首次安装后**重启 DSH Desktop**，之后：
- `设置 → Skills 管理` 中新建/查看/删除 skill；
- 新会话里 Agent 会在合适时自动调用 `recommend_skill`。

## 使用

1. 打开 `设置 → Skills 管理`，点「＋ 新建 skill」，填写名称（kebab-case）、描述、正文。
2. 保存后 skill 写入 `~/.dsh/skills/<name>/SKILL.md`。
3. 在新会话中发起任务（如“写个 Cordis 插件”），Agent 会调用 `recommend_skill` 匹配并返回最合适 skill 的说明。

## 目录结构

- `index.js` — host 半：`recommend_skill` 工具 + 系统提示 + 管理 HTTP API（读写 `~/.dsh/skills`）。
- `client.js` — client 半：设置页「Skills 管理」（`settings.section`）。
- `cordis.patch.yml` — bundle patch：把插件行挂载进 profile 组合。

## 已知限制

- `recommend_skill` 的匹配为关键词打分（名称 > 描述），对中文任务匹配较弱时可补充 `description` 里的英文关键词。
- skill 新建/删除后，需重启 DSH（或等热重载）才进入 runtime 目录。

## License

MIT
