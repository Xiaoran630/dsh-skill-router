window.__ModuleLoader__.load({
  id: "dsh-skill-router",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let React = require("react");

    if (typeof document !== "undefined" && !document.getElementById("dsh-skill-router-style")) {
      const style = document.createElement("style");
      style.id = "dsh-skill-router-style";
      style.textContent = [
        ".skr-root{padding:4px 0;display:flex;flex-direction:column;gap:14px}",
        ".skr-dir{font-family:monospace;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);word-break:break-all}",
        ".skr-card{border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;padding:12px}",
        ".skr-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}",
        ".skr-title{font-weight:600;color:var(--dsw-alias-label-primary,#fff)}",
        ".skr-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);line-height:1.5;margin:0}",
        ".skr-pre{white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:12px;line-height:1.5;margin:8px 0 0;max-height:50vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,#1e1f22);border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;padding:10px;color:var(--dsw-alias-label-primary,#fff)}",
        ".skr-btn{height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:var(--dsw-alias-interactive-bg-hover-accent,#5a5f8a);color:var(--dsw-alias-label-primary,#fff);cursor:pointer;font-size:12px}",
        ".skr-btn.danger{background:transparent;border-color:var(--dsw-alias-state-error-primary,#e5484d);color:var(--dsw-alias-state-error-primary,#e5484d)}",
        ".skr-input,.skr-textarea{width:100%;box-sizing:border-box;font-family:monospace;font-size:13px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:6px;background:var(--dsw-alias-bg-layer-1,#1e1f22);color:var(--dsw-alias-label-primary,#fff)}",
        ".skr-textarea{min-height:120px;resize:vertical;line-height:1.5}",
        ".skr-field{margin-bottom:8px}",
        ".skr-label{display:block;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98);margin-bottom:4px}",
        ".skr-ok{font-size:12px;color:#2ea44f}",
        ".skr-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#e5484d)}",
        ".skr-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f98)}",
      ].join("\n");
      document.head.appendChild(style);
    }

    const inject = ["slots"];

    function api(path, opts) {
      return fetch(window.location.origin + "/skill-router/api/" + path, opts).then((r) => r.json());
    }

    function SkillManager() {
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState(null);
      const [dir, setDir] = React.useState("");
      const [skills, setSkills] = React.useState([]);
      const [open, setOpen] = React.useState(null);
      const [detail, setDetail] = React.useState(null);
      const [creating, setCreating] = React.useState(false);
      const [form, setForm] = React.useState({ name: "", description: "", whenToUse: "", content: "" });
      const [status, setStatus] = React.useState(null);

      const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await api("list");
          if (!data.ok) throw new Error(data.error || "加载失败");
          setDir(data.dir || "");
          setSkills(data.skills || []);
        } catch (e) {
          setError(e && e.message ? e.message : String(e));
        } finally {
          setLoading(false);
        }
      }, []);

      React.useEffect(() => {
        load();
      }, [load]);

      const toggle = (s) => {
        if (open === s.name) {
          setOpen(null);
          setDetail(null);
        } else {
          setOpen(s.name);
          setDetail(s);
        }
      };

      const removeSkill = async (s) => {
        if (!window.confirm("确认删除 skill「" + s.name + "」？")) return;
        setStatus(null);
        try {
          const data = await api("remove", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: s.dirName || s.name }),
          });
          if (!data.ok) throw new Error(data.error || "删除失败");
          setStatus({ ok: true, message: data.message || "已删除" });
          setOpen(null);
          setDetail(null);
          await load();
        } catch (e) {
          setStatus({ ok: false, message: e && e.message ? e.message : String(e) });
        }
      };

      const createSkill = async () => {
        if (!form.name.trim()) {
          setStatus({ ok: false, message: "请填写名称" });
          return;
        }
        setStatus(null);
        try {
          const data = await api("create", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(form),
          });
          if (!data.ok) throw new Error(data.error || "创建失败");
          setStatus({ ok: true, message: data.message || "已创建" });
          setCreating(false);
          setForm({ name: "", description: "", whenToUse: "", content: "" });
          await load();
        } catch (e) {
          setStatus({ ok: false, message: e && e.message ? e.message : String(e) });
        }
      };

      if (loading) {
        return React.createElement("div", { className: "skr-hint" }, "正在加载 skills…");
      }

      return React.createElement(
        "div",
        { className: "skr-root" },
        React.createElement("div", { className: "skr-dir" }, "存储目录：" + (dir || "未解析")),
        error ? React.createElement("p", { className: "skr-err" }, "加载失败：" + error) : null,

        React.createElement(
          "div",
          null,
          React.createElement(
            "button",
            { className: "skr-btn", type: "button", onClick: () => setCreating(!creating) },
            creating ? "收起" : "＋ 新建 skill"
          ),
          creating
            ? React.createElement(
                "div",
                { className: "skr-card", style: { marginTop: 10 } },
                React.createElement(
                  "div",
                  { className: "skr-field" },
                  React.createElement("label", { className: "skr-label" }, "名称（kebab-case，如 my-skill）"),
                  React.createElement("input", {
                    className: "skr-input",
                    value: form.name,
                    onChange: (ev) => setForm((f) => ({ ...f, name: ev.target.value })),
                  })
                ),
                React.createElement(
                  "div",
                  { className: "skr-field" },
                  React.createElement("label", { className: "skr-label" }, "描述 description"),
                  React.createElement("input", {
                    className: "skr-input",
                    value: form.description,
                    onChange: (ev) => setForm((f) => ({ ...f, description: ev.target.value })),
                  })
                ),
                React.createElement(
                  "div",
                  { className: "skr-field" },
                  React.createElement("label", { className: "skr-label" }, "何时使用 whenToUse（可选）"),
                  React.createElement("input", {
                    className: "skr-input",
                    value: form.whenToUse,
                    onChange: (ev) => setForm((f) => ({ ...f, whenToUse: ev.target.value })),
                  })
                ),
                React.createElement(
                  "div",
                  { className: "skr-field" },
                  React.createElement("label", { className: "skr-label" }, "正文（skill 指令）"),
                  React.createElement("textarea", {
                    className: "skr-textarea",
                    value: form.content,
                    onChange: (ev) => setForm((f) => ({ ...f, content: ev.target.value })),
                  })
                ),
                React.createElement("button", { className: "skr-btn", type: "button", onClick: createSkill }, "保存 skill")
              )
            : null
        ),

        status ? React.createElement("p", { className: status.ok ? "skr-ok" : "skr-err" }, status.message) : null,

        skills.length === 0
          ? React.createElement(
              "p",
              { className: "skr-hint" },
              "（空）~/.dsh/skills 下还没有 skill。点「＋ 新建 skill」创建，之后让 Agent 通过 recommend_skill 工具自动匹配。"
            )
          : skills.map((s) => {
              const expanded = open === s.name;
              return React.createElement(
                "div",
                { className: "skr-card", key: s.name },
                React.createElement(
                  "div",
                  { className: "skr-head" },
                  React.createElement("div", { className: "skr-title" }, s.name),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "button",
                      { className: "skr-btn", type: "button", style: { marginRight: 6 }, onClick: () => toggle(s) },
                      expanded ? "收起" : "查看"
                    ),
                    React.createElement("button", { className: "skr-btn danger", type: "button", onClick: () => removeSkill(s) }, "删除")
                  )
                ),
                React.createElement("p", { className: "skr-desc" }, s.description || "（无描述）"),
                expanded && detail ? React.createElement("pre", { className: "skr-pre" }, detail.content || "（无内容）") : null
              );
            })
      );
    }

    function apply(ctx) {
      ctx.slots.inject("settings.section", () =>
        ctx.slots.register(
          {
            name: "settings.section",
            id: "skill-router",
            order: 40,
            label: () => "Skills 管理",
            inject: () => ({}),
          },
          SkillManager
        )
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
