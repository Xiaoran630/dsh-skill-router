import { readFile, writeFile, mkdir, rm, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const name = "dsh-skill-router";
const inject = ["skills", "tools", "systemPrompt", "webServer"];

/** skills 根目录：~/.dsh/skills */
function skillsDir() {
  return join(homedir(), ".dsh", "skills");
}

function skillDirPath(skillName) {
  return join(skillsDir(), skillName);
}

function skillFile(skillName) {
  return join(skillDirPath(skillName), "SKILL.md");
}

/** 解析 SKILL.md 的 YAML frontmatter（name / description / whenToUse）+ 正文 */
function parseFrontmatter(text) {
  const m = /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/.exec(text || "");
  if (!m) return { name: "", description: "", whenToUse: "", body: text || "" };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    meta[k] = v;
  }
  return {
    name: meta.name || "",
    description: meta.description || "",
    whenToUse: meta.whenToUse || "",
    body: m[2] || "",
  };
}

function buildFrontmatter(skillName, description, whenToUse, body) {
  const head = ["---", "name: " + skillName];
  if (description) head.push("description: " + description);
  if (whenToUse) head.push("whenToUse: " + whenToUse);
  head.push("---");
  return head.join("\n") + "\n\n" + (body || "");
}

/** 校验 skill 名称（kebab-case） */
function validName(s) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(s || ""));
}

/** 扫描 ~/.dsh/skills 下的所有 skill */
async function listUserSkills() {
  let entries;
  try {
    entries = await readdir(skillsDir(), { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dirName = e.name;
    try {
      const text = await readFile(skillFile(dirName), "utf8");
      const fm = parseFrontmatter(text);
      out.push({
        name: fm.name || dirName,
        dirName,
        description: fm.description,
        whenToUse: fm.whenToUse,
        content: text,
        size: text.length,
      });
    } catch {
      // 无 SKILL.md，跳过
    }
  }
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return out;
}

/** 打分：任务命中 skill 名称/说明关键词越多分越高 */
function scoreSkill(task, s) {
  const t = String(task || "").toLowerCase();
  let total = 0;
  const nameParts = String(s.name || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2);
  for (const p of nameParts) if (t.indexOf(p) !== -1) total += 5;
  const words = String((s.description || "") + " " + (s.whenToUse || ""))
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter((w) => w.length >= 3);
  for (const w of words) if (t.indexOf(w) !== -1) total += 1;
  return total;
}

/** 工具的 scope 选项：优先当前 Agent 的视图 */
function scopeOptions(exec) {
  return exec && exec.agent ? { scope: exec.agent } : {};
}

/** 合并去重（runtime catalog + 文件系统用户 skill） */
function mergeByName(a, b) {
  const out = [];
  const seen = new Set();
  for (const s of a) {
    if (!s || seen.has(s.name)) continue;
    seen.add(s.name);
    out.push(s);
  }
  for (const s of b) {
    if (!s || seen.has(s.name)) continue;
    seen.add(s.name);
    out.push(s);
  }
  return out;
}

async function recommend(ctx, task, exec) {
  const opts = scopeOptions(exec);
  let catalog = [];
  try {
    catalog = await ctx.skills.list(opts);
  } catch {
    try {
      catalog = await ctx.skills.list();
    } catch {}
  }

  const userSkills = await listUserSkills();
  const merged = mergeByName(catalog, userSkills);

  const summaries = merged.map((s) => ({
    name: s.name,
    description: s.description || "",
    whenToUse: s.whenToUse || "",
  }));

  let best = null;
  let bestScore = 0;
  for (const s of summaries) {
    const sc = scoreSkill(task, s);
    if (sc > bestScore) {
      bestScore = sc;
      best = s;
    }
  }

  if (!best) {
    return { matched: "", reason: "", content: "", candidates: summaries };
  }

  let content = "";
  try {
    const def = await ctx.skills.get(best.name, opts);
    if (def && def.content) content = def.content;
  } catch {}
  if (!content) {
    try {
      content = await readFile(skillFile(best.name), "utf8");
    } catch {}
  }
  if (!content) content = best.description || "";

  return {
    matched: best.name,
    reason: "任务命中「" + best.name + "」相关关键词（得分 " + bestScore + "）",
    content,
    candidates: summaries.slice(0, 20),
  };
}

function renderToolResult(args, value) {
  const v = value || {};
  if (v.error) return [{ type: "text", text: "推荐失败：" + v.error }];
  if (v.matched) {
    return [
      {
        type: "text",
        text: "✅ 匹配 skill：" + v.matched + "\n原因：" + v.reason + "\n\n--- skill 说明 ---\n" + v.content,
      },
    ];
  }
  const lines = ["未匹配到精确 skill，可用目录如下："];
  for (const c of v.candidates || []) lines.push("- " + c.name + "：" + c.description);
  return [{ type: "text", text: lines.join("\n") }];
}

function writeJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function apply(ctx) {
  // 1) 系统提示路由提示
  ctx.effect(
    () =>
      ctx.systemPrompt.section({
        name: "skill-router-hint",
        order: 500,
        text: "处理新任务时，若任务可能对应某个可用 skill（例如涉及 Cordis 插件、工作流、特定领域流程），先调用 recommend_skill(task) 工具并传入任务描述，获取最匹配 skill 的完整说明并遵循其执行。",
      }),
    name + ": hint"
  );

  // 2) recommend_skill 工具
  ctx.effect(
    () =>
      ctx.tools.register({
        name: "recommend_skill",
        description:
          "按当前任务描述自动匹配并返回最合适 skill 的完整说明。当任务可能对应某个 skill（例如涉及 Cordis 插件、工作流、特定领域流程）时调用它，传入任务描述；返回的 skill 说明应作为后续执行的指令。",
        parameters: {
          type: "object",
          properties: {
            task: { type: "string", description: "当前任务的一句话描述（中文或英文）" },
          },
          required: ["task"],
        },
        output: {
          schema: { type: "object", additionalProperties: true },
          render: renderToolResult,
        },
        execute: async (args, exec) => {
          const task = String((args && args.task) || "").trim();
          if (!task) return { error: "缺少 task 参数" };
          return recommend(ctx, task.toLowerCase(), exec);
        },
      }),
    name + ": tool"
  );

  // 3) 管理 API（client 通过 fetch 读写 ~/.dsh/skills）
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: "/skill-router/api",
        handler: async (req, res) => {
          try {
            const url = new URL(req.url ?? "/", "http://dsh.internal");
            const sub = url.pathname.replace(/^\/skill-router\/api\/?/, "");

            if (sub === "list" || sub === "") {
              if (req.method !== "GET") {
                writeJson(res, 405, { ok: false, error: "method not allowed" });
                return;
              }
              const skills = await listUserSkills();
              writeJson(res, 200, { ok: true, dir: skillsDir(), skills });
              return;
            }

            if (sub === "catalog") {
              if (req.method !== "GET") {
                writeJson(res, 405, { ok: false, error: "method not allowed" });
                return;
              }
              let catalog = [];
              try {
                catalog = await ctx.skills.list();
              } catch {}
              writeJson(res, 200, {
                ok: true,
                catalog: catalog.map((s) => ({
                  name: s.name,
                  description: s.description,
                  whenToUse: s.whenToUse,
                  source: String(s.source || ""),
                })),
              });
              return;
            }

            if (sub === "create") {
              if (req.method !== "POST") {
                writeJson(res, 405, { ok: false, error: "method not allowed" });
                return;
              }
              const body = await readJsonBody(req);
              const skillName = typeof body.name === "string" ? body.name.trim() : "";
              const description = typeof body.description === "string" ? body.description.trim() : "";
              const whenToUse = typeof body.whenToUse === "string" ? body.whenToUse.trim() : "";
              const content = typeof body.content === "string" ? body.content : "";
              if (!validName(skillName)) {
                writeJson(res, 400, { ok: false, error: "非法 skill 名称（需 kebab-case，如 my-skill）" });
                return;
              }
              if (!description && !content.trim()) {
                writeJson(res, 400, { ok: false, error: "description 与 content 至少填一个" });
                return;
              }
              const text = buildFrontmatter(skillName, description, whenToUse, content);
              await mkdir(skillDirPath(skillName), { recursive: true });
              await writeFile(skillFile(skillName), text, "utf8");
              writeJson(res, 200, { ok: true, message: "已创建 skill：" + skillName, path: skillFile(skillName) });
              return;
            }

            if (sub === "remove") {
              if (req.method !== "POST") {
                writeJson(res, 405, { ok: false, error: "method not allowed" });
                return;
              }
              const body = await readJsonBody(req);
              const skillName = typeof body.name === "string" ? body.name.trim() : "";
              if (!skillName) {
                writeJson(res, 400, { ok: false, error: "缺少 name" });
                return;
              }
              await rm(skillDirPath(skillName), { recursive: true, force: true });
              writeJson(res, 200, { ok: true, message: "已删除 skill：" + skillName });
              return;
            }

            writeJson(res, 404, { ok: false, error: "unknown method" });
          } catch (error) {
            writeJson(res, 500, {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        },
      }),
    name + ": api"
  );
}

export { apply, inject, name };
