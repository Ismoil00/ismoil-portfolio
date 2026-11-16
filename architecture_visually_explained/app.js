/* Portfolio architecture: renders every view from window.ARCH (the data/*.js files). No libraries. */
(() => {
  "use strict";

  const A = window.ARCH;
  const CHECKED_ON = "2026-11-16";
  const NS = "http://www.w3.org/2000/svg";
  const main = document.getElementById("view");
  const state = { view: null, api: {}, cleanups: [] };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- DOM helpers
  function setAttrs(el, attrs) {
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value == null || value === false) continue;
      if (key === "text") el.textContent = value;
      else if (key === "style") for (const [prop, v] of Object.entries(value)) el.style.setProperty(prop, v);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  function add(el, kids) {
    for (const kid of [kids].flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    setAttrs(el, attrs);
    return add(el, kids);
  };
  const s = (tag, attrs, ...kids) => {
    const el = document.createElementNS(NS, tag);
    setAttrs(el, attrs);
    return add(el, kids);
  };
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const cssVar = (name) => `var(${name})`;
  const textWidth = (text, px, factor = 0.56) => text.length * px * factor;

  /** Click + Enter/Space for things that aren't <button>s (SVG groups, table rows). */
  function pressable(el, handler) {
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "button");
    el.addEventListener("click", handler);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler(e);
      }
    });
    return el;
  }
  const onCleanup = (fn) => state.cleanups.push(fn);
  const markers = (prefix) =>
    s("defs", {},
      s("marker", { id: `${prefix}-arrow`, viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
        s("path", { d: "M2 1L8 5L2 9" })));

  // ---------------------------------------------------------------- detail drawer
  const detailEl = document.getElementById("detail");
  let detailOnClose = null;

  function openDetail(kicker, title, content, onClose = null) {
    document.getElementById("detail-kicker").textContent = kicker;
    document.getElementById("detail-title").textContent = title;
    const body = document.getElementById("detail-body");
    body.replaceChildren();
    add(body, content);
    body.scrollTop = 0;
    detailOnClose = onClose;
    detailEl.hidden = false;
    document.body.classList.add("has-detail");
  }
  function closeDetail() {
    if (detailEl.hidden) return;
    detailEl.hidden = true;
    document.body.classList.remove("has-detail");
    const fn = detailOnClose;
    detailOnClose = null;
    if (fn) fn();
  }
  document.getElementById("detail-close").addEventListener("click", closeDetail);

  const block = (title, ...content) => h("section", {}, h("h3", { text: title }), content);
  const bullets = (items) => h("ul", {}, items.map((item) => h("li", {}, item)));
  const kv = (pairs) =>
    h("dl", { class: "kv" }, pairs.filter(Boolean).flatMap(([k, v]) => [h("dt", { text: k }), h("dd", {}, v)]));
  const code = (text) => h("code", { text });
  const viewHead = (title, lead, ...extra) =>
    h("div", { class: "view-head" }, h("div", {}, h("h1", { text: title }), h("p", { class: "lead", text: lead })), extra);
  const section = (title, lead, ...content) =>
    h("div", { class: "section" }, h("h2", { text: title }), lead ? h("p", { class: "lead", text: lead }) : null, content);

  // ---------------------------------------------------------------- router
  const views = { overview: overviewView, backend: backendView, frontends: frontendsView, database: databaseView, flows: flowsView };
  const TITLES = { overview: "System", backend: "Backend", frontends: "Frontends", database: "Database", flows: "Flows" };

  function parseHash() {
    const raw = decodeURIComponent(location.hash.replace(/^#/, ""));
    const i = raw.indexOf("/");
    return i < 0 ? [raw, ""] : [raw.slice(0, i), raw.slice(i + 1)];
  }
  function route() {
    let [name, arg] = parseHash();
    if (!views[name]) name = "overview";
    $$(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.view === name));
    if (state.view !== name) {
      closeDetail();
      state.cleanups.splice(0).forEach((fn) => fn());
      main.replaceChildren();
      state.view = name;
      state.api = views[name](main) || {};
      document.title = `${TITLES[name]} · Portfolio architecture`;
      window.scrollTo(0, 0);
    }
    if (arg && state.api.select) state.api.select(arg);
  }
  function go(view, arg = "") {
    const hash = "#" + view + (arg ? "/" + encodeURIComponent(arg) : "");
    if (location.hash === hash) route();
    else location.hash = hash;
  }
  /** Keep the address bar in step with the selection (shareable), without re-rendering. */
  const setArg = (view, arg = "") => history.replaceState(null, "", "#" + view + (arg ? "/" + encodeURIComponent(arg) : ""));

  // ================================================================ 1 · SYSTEM
  function overviewView(root) {
    const S = A.system;
    const W = 1200;
    const H = 720;
    const byId = Object.fromEntries(S.nodes.map((n) => [n.id, n]));
    const jumpTo = { backend: "backend", public: "frontends", admin: "frontends", db: "database" };
    const edgeNo = Object.fromEntries(S.edges.map((e, i) => [e.id, i + 1]));

    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "System diagram" });
    svg.append(markers("ov"));
    const edgeLayer = s("g");
    const nodeLayer = s("g");
    const dotLayer = s("g");
    svg.append(edgeLayer, nodeLayer, dotLayer);

    const anchor = (n, side, t = 0.5) =>
      ({
        l: { x: n.x, y: n.y + n.h * t, dx: -1, dy: 0 },
        r: { x: n.x + n.w, y: n.y + n.h * t, dx: 1, dy: 0 },
        t: { x: n.x + n.w * t, y: n.y, dx: 0, dy: -1 },
        b: { x: n.x + n.w * t, y: n.y + n.h, dx: 0, dy: 1 },
      })[side];
    const curve = (a, b) => {
      const k = Math.max(40, Math.min(170, Math.hypot(b.x - a.x, b.y - a.y) * 0.45));
      return `M${a.x},${a.y} C${a.x + a.dx * k},${a.y + a.dy * k} ${b.x + b.dx * k},${b.y + b.dy * k} ${b.x + b.dx * 5},${b.y + b.dy * 5}`;
    };

    const edges = {};
    for (const e of S.edges) {
      const d = curve(anchor(byId[e.a[0]], e.a[1], e.a[2]), anchor(byId[e.b[0]], e.b[1], e.b[2]));
      const line = s("path", { class: "line", d, "marker-end": "url(#ov-arrow)" });
      const g = s("g", { class: "edge" + (e.dashed ? " dashed" : ""), "aria-label": `Connection ${edgeNo[e.id]}: ${byId[e.a[0]].title} to ${byId[e.b[0]].title}` },
        line, s("path", { class: "hit", d }));
      pressable(g, (ev) => {
        ev.stopPropagation();
        selectEdge(e.id);
      });
      edgeLayer.append(g);
      edges[e.id] = { g, line, data: e };
    }

    const nodes = {};
    for (const n of S.nodes) {
      const kind = S.kinds[n.kind];
      const g = s("g", { class: "node", style: { "--c": cssVar(kind.color) }, "aria-label": n.title });
      g.append(
        s("rect", { class: "box", x: n.x, y: n.y, width: n.w, height: n.h, rx: 14 }),
        s("circle", { class: "bar", cx: n.x + 20, cy: n.y + 21, r: 4 }),
        s("text", { class: "t-small", x: n.x + 30, y: n.y + 25, text: kind.label }),
        s("text", { class: "t-title", x: n.x + 16, y: n.y + 47, text: n.title }),
        s("text", { class: "t-sub", x: n.x + 16, y: n.y + 66, text: n.sub }),
      );
      let y = n.y + 66;
      if (n.folder && n.h >= 110) {
        y += 22;
        g.append(s("text", { class: "t-mono t-small", x: n.x + 16, y, text: n.folder + "/" }));
      }
      if (n.inner) {
        y += 14;
        for (const line of n.inner) {
          g.append(s("rect", { class: "inner", x: n.x + 12, y, width: n.w - 24, height: 30, rx: 8 }));
          g.append(s("text", { class: "t-mono", x: n.x + 22, y: y + 19, text: line }));
          y += 36;
        }
      }
      pressable(g, (ev) => {
        ev.stopPropagation();
        selectNode(n.id);
      });
      nodeLayer.append(g);
      nodes[n.id] = g;
    }
    svg.addEventListener("click", () => {
      clearSel();
      closeDetail();
    });

    const caption = h("span", { class: "hint" });
    const traceBar = h("div", { class: "trace-bar" },
      h("span", { class: "hint", text: "Play a journey:" }),
      S.traces.map((t) => h("button", { class: "btn", type: "button", onclick: () => playTrace(t) }, "▶ " + t.label)),
      caption);
    const legend = h("div", { class: "legend" },
      Object.values(S.kinds).map((k) => h("span", {}, h("i", { style: { "--c": cssVar(k.color) } }), k.label)),
      h("span", {}, h("i", { class: "line dash", style: { "--c": "var(--faint)" } }), "dashed: files and tooling"));
    const connList = h("div", { class: "conn-list" },
      S.edges.map((e) => {
        const b = h("button", { type: "button", onclick: () => selectEdge(e.id) },
          h("span", { class: "no", text: String(edgeNo[e.id]) }),
          h("span", {}, h("b", { text: `${byId[e.a[0]].title} → ${byId[e.b[0]].title}` }), h("small", { text: e.label })));
        b.addEventListener("mouseenter", () => highlight(new Set([e.a[0], e.b[0]]), new Set([e.id])));
        b.addEventListener("mouseleave", () => clearSel());
        return b;
      }));

    root.append(
      viewHead("1 · The whole system",
        "Two Next.js apps face the browsers; one FastAPI backend owns every piece of data and is the only part that talks to PostgreSQL, file storage and Claude. Click a box or an arrow, or play a journey."),
      h("div", { class: "card canvas-card" }, traceBar, h("div", { class: "scroll-x" }, svg), legend),
      section("The connections", "Every arrow on the map, numbered. Hover to find it, click for the details.", connList),
      section("At a glance", null,
        h("div", { class: "facts" }, S.facts.map(([k, v]) => h("div", { class: "card fact" }, h("small", { text: k }), v))),
        h("div", { class: "card table-wrap", style: { "margin-top": "12px" } },
          h("table", { class: "grid" },
            h("thead", {}, h("tr", {}, ["Part", "Development", "E2E tests", "Folder"].map((x) => h("th", { text: x })))),
            h("tbody", {},
              [["Public site", "3000", "3100", "frontends/public"], ["Admin panel", "3001", "3101", "frontends/cms-admin"],
                ["Backend", "8000", "8100", "backend"], ["PostgreSQL", "5432", "5432 (database portfolio_e2e)", "—"]]
                .map((r) => h("tr", {}, r.map((c, i) => h("td", {}, i === 3 ? code(c) : c)))))))),
    );

    // Number badges sit at the middle of each arrow (paths must be in the page to measure them).
    for (const { g, line, data } of Object.values(edges)) {
      const p = line.getPointAtLength(line.getTotalLength() * 0.5);
      g.append(s("g", { class: "badge" }, s("circle", { cx: p.x, cy: p.y, r: 11 }), s("text", { x: p.x, y: p.y + 4, text: String(edgeNo[data.id]) })));
    }
    // Fit the canvas to what was drawn (curves may bulge past the planned area).
    const box = svg.getBBox();
    svg.setAttribute("viewBox", `${Math.floor(box.x - 16)} ${Math.floor(box.y - 16)} ${Math.ceil(box.width + 32)} ${Math.ceil(box.height + 32)}`);

    function clearSel() {
      for (const el of svg.querySelectorAll(".on, .dim")) el.classList.remove("on", "dim");
    }
    function highlight(nodeIds, edgeIds) {
      for (const [id, g] of Object.entries(nodes)) {
        g.classList.toggle("on", nodeIds.has(id));
        g.classList.toggle("dim", !nodeIds.has(id));
      }
      for (const [id, e] of Object.entries(edges)) {
        e.g.classList.toggle("on", edgeIds.has(id));
        e.g.classList.toggle("dim", !edgeIds.has(id));
      }
    }
    function connButton(e) {
      const other = (id) => byId[id].title;
      return h("button", { class: "link-btn", type: "button", onclick: () => selectEdge(e.id) },
        `${edgeNo[e.id]} · ${other(e.a[0])} → ${other(e.b[0])}: ${e.label}`);
    }
    function selectNode(id) {
      const n = byId[id];
      const linked = S.edges.filter((e) => e.a[0] === id || e.b[0] === id);
      highlight(new Set([id, ...linked.flatMap((e) => [e.a[0], e.b[0]])]), new Set(linked.map((e) => e.id)));
      openDetail(S.kinds[n.kind].label, n.title, [
        h("p", { class: "what", text: n.what }),
        kv([
          n.folder ? ["Folder", code(n.folder + "/")] : null,
          ["Runs as", n.sub],
          n.readme ? ["Read more", code(n.readme)] : null,
        ]),
        block("What it does", bullets(n.does)),
        linked.length ? block("Connections", bullets(linked.map(connButton))) : null,
        jumpTo[id] ? h("button", { class: "btn primary", type: "button", onclick: () => go(jumpTo[id]) }, `Open the ${TITLES[jumpTo[id]]} view →`) : null,
      ], () => {
        clearSel();
        setArg("overview");
      });
      setArg("overview", id);
    }
    function selectEdge(id) {
      const e = edges[id].data;
      highlight(new Set([e.a[0], e.b[0]]), new Set([id]));
      openDetail(`Connection ${edgeNo[id]}`, `${byId[e.a[0]].title} → ${byId[e.b[0]].title}`, [
        h("p", { class: "what", text: e.carries }),
        kv([["Protocol", e.protocol], ["Who may call", e.auth], ["Label", e.label]]),
        h("div", { class: "toolbar" },
          h("button", { class: "btn", type: "button", onclick: () => selectNode(e.a[0]) }, byId[e.a[0]].title),
          h("button", { class: "btn", type: "button", onclick: () => selectNode(e.b[0]) }, byId[e.b[0]].title)),
      ], () => {
        clearSel();
        setArg("overview");
      });
      setArg("overview", id);
    }

    let traceToken = 0;
    onCleanup(() => traceToken++);
    function playTrace(trace) {
      const token = ++traceToken;
      closeDetail();
      clearSel();
      const dot = s("circle", { class: "trace-dot", r: 7, cx: -20, cy: -20 });
      dotLayer.replaceChildren(dot);
      const seenNodes = new Set();
      const seenEdges = new Set();
      let i = 0;
      const next = () => {
        if (token !== traceToken) return;
        if (i >= trace.steps.length) {
          caption.textContent = `${trace.label}: done.`;
          setTimeout(() => {
            if (token !== traceToken) return;
            dot.remove();
            clearSel();
            caption.textContent = "";
          }, 1800);
          return;
        }
        const raw = trace.steps[i];
        const back = raw.startsWith("-");
        const e = edges[back ? raw.slice(1) : raw];
        seenEdges.add(e.data.id);
        seenNodes.add(e.data.a[0]).add(e.data.b[0]);
        highlight(seenNodes, seenEdges);
        const from = byId[back ? e.data.b[0] : e.data.a[0]].title;
        const to = byId[back ? e.data.a[0] : e.data.b[0]].title;
        caption.textContent = `${i + 1}/${trace.steps.length} · ${from} → ${to}${back ? " (answer)" : ""}`;
        const len = e.line.getTotalLength();
        const ms = reduceMotion ? 0 : 750;
        const t0 = performance.now();
        const frame = (now) => {
          if (token !== traceToken) return;
          const k = ms ? Math.min(1, (now - t0) / ms) : 1;
          const p = e.line.getPointAtLength(len * (back ? 1 - k : k));
          dot.setAttribute("cx", p.x);
          dot.setAttribute("cy", p.y);
          if (k < 1) requestAnimationFrame(frame);
          else setTimeout(() => {
            i++;
            next();
          }, reduceMotion ? 900 : 220);
        };
        requestAnimationFrame(frame);
      };
      next();
    }

    return {
      select(arg) {
        if (byId[arg]) selectNode(arg);
        else if (edges[arg]) selectEdge(arg);
      },
    };
  }

  // ================================================================ 2 · BACKEND
  function backendView(root) {
    const B = A.backend;
    const files = new Map();
    for (const L of B.layers) for (const [path, desc] of L.files) if (!files.has(path)) files.set(path, { desc, layer: L });
    for (const group of B.side) for (const [path, desc] of group.files) if (!files.has(path)) files.set(path, { desc, group });
    const layerEls = new Map();
    const short = (path) => path.replace(/^app\//, "");
    const findFile = (token) => {
      const clean = token.trim().replace(/\s.*$/, "");
      for (const path of files.keys()) {
        if (path === clean || short(path) === clean || path === "app/" + clean) return path;
      }
      return null;
    };
    const areasOf = (path) =>
      B.matrix.rows.filter((row) => row.cells.slice(0, 4).some((cell) => cell.split(" · ").some((tok) => findFile(tok) === path))).map((r) => r.area);

    function markLayer(id) {
      for (const [lid, el] of layerEls) el.classList.toggle("on", lid === id);
    }
    function showLayer(L, index) {
      markLayer(L.id);
      openDetail(`Layer ${index + 1}`, L.title, [
        h("p", { class: "what", text: L.rule }),
        block(`Files (${L.files.length})`,
          bullets(L.files.map(([path, desc]) => h("span", {}, h("button", { class: "link-btn", type: "button", onclick: () => showFile(path) }, path), h("br"), desc)))),
      ], () => {
        markLayer(null);
        setArg("backend");
      });
      setArg("backend", L.id);
    }
    function showFile(path) {
      const f = files.get(path);
      if (!f) return;
      const where = f.layer || f.group;
      if (f.layer) {
        markLayer(f.layer.id);
        layerEls.get(f.layer.id)?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      } else markLayer(null);
      const areas = areasOf(path);
      openDetail("Backend file", path, [
        h("p", { class: "what", text: f.desc }),
        kv([
          [f.layer ? "Layer" : "Group", where.title],
          f.layer ? ["Layer rule", where.rule] : null,
          areas.length ? ["Feature areas", areas.join(" · ")] : null,
        ]),
      ], () => {
        markLayer(null);
        setArg("backend");
      });
      setArg("backend", path);
    }
    function showCell(row, column, cell) {
      const tokens = cell.split(" · ");
      const tableNames = new Set([...A.dbSchema.tables.map((t) => t.name), "alembic_version"]);
      const found = tokens.map((tok) => ({ tok, path: findFile(tok) }));
      const tablesHere = column === "Tables" ? tokens.filter((t) => tableNames.has(t.trim())) : [];
      openDetail(`${row.area} · ${column}`, cell, [
        column === "Tables"
          ? block("Tables", tablesHere.length
            ? bullets(tablesHere.map((t) => h("button", { class: "link-btn", type: "button", onclick: () => go("database", t.trim()) }, t.trim())))
            : h("p", {}, cell, " — ", h("button", { class: "link-btn", type: "button", onclick: () => go("database") }, "open the database view")))
          : block("Files", bullets(found.map(({ tok, path }) => path
            ? h("span", {}, h("button", { class: "link-btn", type: "button", onclick: () => showFile(path) }, path), h("br"), files.get(path).desc)
            : h("span", { text: tok })))),
      ]);
    }

    const connector = () => h("div", { class: "connector", "aria-hidden": "true" },
      h("span", {}, s("svg", { viewBox: "0 0 14 22" }, s("path", { d: "M7 1v18M2 14l5 6 5-6" }))));
    const endCard = (label, text) => h("div", { class: "layer", style: { "--c": "var(--faint)", cursor: "default" } },
      h("span", { class: "num", text: "↓" }), h("div", {}, h("h3", { text: label }), h("p", { class: "hint", text })));

    const pipeline = h("div", { class: "pipeline" }, endCard("A request arrives", "From the public site's server (Server Components, Server Actions) or from the admin panel (forwarded browser calls and server calls)."));
    B.layers.forEach((L, i) => {
      pipeline.append(connector());
      const el = h("div", { class: "layer", style: { "--c": cssVar(L.color), "--layer-c": cssVar(L.color) } },
        h("span", { class: "num", text: String(i + 1) }),
        h("div", {},
          h("h3", {}, L.title, h("small", { text: L.sub })),
          h("p", { class: "hint", text: L.rule }),
          h("div", { class: "chips" }, L.files.map(([path]) => pressable(h("span", { class: "chip", text: short(path) }), (ev) => {
            ev.stopPropagation();
            showFile(path);
          })))));
      pressable(el, () => showLayer(L, i));
      layerEls.set(L.id, el);
      pipeline.append(el);
    });
    pipeline.append(connector(), endCard("Outside the backend", "PostgreSQL (schema work) · file storage (disk or S3) · Claude API. The answer travels back up as JSON."));

    const side = h("div", { class: "side-stack" }, B.side.map((group) =>
      h("div", { class: "card side-card" }, h("h3", { text: group.title }),
        h("ul", { class: "file-list" }, group.files.map(([path]) =>
          h("li", {}, h("button", { type: "button", title: files.get(path)?.desc || "", onclick: () => showFile(path) }, short(path))))))));

    const matrix = h("table", { class: "grid" },
      h("thead", {}, h("tr", {}, h("th", { text: "Feature" }), B.matrix.columns.map((c) => h("th", { text: c })))),
      h("tbody", {}, B.matrix.rows.map((row) =>
        h("tr", {}, h("td", {}, h("b", { text: row.area })),
          row.cells.map((cell, i) => pressable(h("td", { class: "cell-btn", text: cell }), () => showCell(row, B.matrix.columns[i], cell)))))));

    const errors = h("table", { class: "grid" },
      h("thead", {}, h("tr", {}, ["Status", "Error class", "When"].map((x) => h("th", { text: x })))),
      h("tbody", {}, B.errors.map(([status, cls, when]) => h("tr", {}, h("td", {}, h("b", { text: status })), h("td", {}, code(cls)), h("td", { text: when })))));

    root.append(
      viewHead("2 · Inside the backend",
        "One request goes down these layers and back up. Each layer has one job, so a rule lives in exactly one place. Click a layer or a file."),
      h("div", { class: "backend-grid" }, pipeline, side),
      section("Who handles what", "Every feature follows the same path: route → schema → service → repository → tables. Click a cell for the files.",
        h("div", { class: "card table-wrap" }, matrix)),
      section("Errors the frontends get", "Services raise these; core/errors.py turns them into JSON {detail, code, …} with the right status.",
        h("div", { class: "card table-wrap" }, errors)),
    );

    return {
      select(arg) {
        if (files.has(arg)) showFile(arg);
        else {
          const i = B.layers.findIndex((L) => L.id === arg);
          if (i >= 0) showLayer(B.layers[i], i);
        }
      },
    };
  }

  // ================================================================ 3 · FRONTENDS
  function endpointFiles(text) {
    const t = text.toLowerCase();
    if (t.startsWith("options")) return ["app/api/admin/selectors.py", "app/api/admin/content.py"];
    if (t.includes("/public/contact")) return ["app/api/public/contact.py"];
    if (t.includes("/public/")) return ["app/api/public/content.py"];
    if (t.includes("/auth/")) return ["app/api/auth.py"];
    if (t.includes("/admin/selectors")) return ["app/api/admin/selectors.py"];
    if (/\/admin\/(experiences|projects|testimonials|certificates)/.test(t)) return ["app/api/admin/content.py"];
    if (/\/admin\/(hero|about|contacts|other-links|messages|tech-showcase)/.test(t)) return ["app/api/admin/sections.py"];
    if (t.includes("/admin/media")) return ["app/api/admin/media.py"];
    if (t.includes("/admin/translate")) return ["app/api/admin/translate.py"];
    return [];
  }

  function frontendsView(root) {
    const F = A.frontends;
    const rows = new Map();

    function showPage(app, index) {
      const page = app.pages[index];
      for (const [key, tr] of rows) tr.classList.toggle("on", key === `${app.id}:${index}`);
      const items = page.calls.map((call) => {
        const endpoint = app.functions ? app.functions[call] || call : call;
        const backendFiles = endpointFiles(endpoint);
        return h("span", {},
          app.functions ? [code(call), " → "] : null,
          h("b", { text: endpoint }),
          backendFiles.length ? [h("br"), "handled in ",
            backendFiles.map((f, i) => [i ? ", " : "", h("button", { class: "link-btn", type: "button", onclick: () => go("backend", f) }, f)])] : null);
      });
      openDetail(`${app.title} page`, page.route, [
        kv([["File", code(page.file)], page.note ? ["Note", page.note] : null]),
        items.length ? block("Calls to the backend", bullets(items)) : h("p", { class: "hint", text: "This page calls no backend endpoint." }),
      ], () => {
        rows.forEach((tr) => tr.classList.remove("on"));
        setArg("frontends");
      });
      setArg("frontends", `${app.id}:${index}`);
    }

    const apps = h("div", { class: "apps" }, F.apps.map((app) =>
      h("div", { class: "card app-card" },
        h("h2", { text: app.title }),
        h("div", { class: "hint mono", text: app.sub }),
        h("p", { text: app.summary }),
        h("h3", { text: "How a request flows", style: { "margin-bottom": "10px" } }),
        h("ol", { class: "steps", style: { "--c": cssVar(app.color) } },
          app.path.map(([where, what], i) => h("li", {}, h("span", { class: "dot", text: String(i + 1) }), h("div", {}, h("b", { text: where }), h("span", { text: what }))))),
        h("h3", { text: "Also worth knowing", style: { margin: "6px 0 8px" } }),
        h("div", { class: "mini-list" }, app.client.map(([k, v]) => h("div", {}, h("b", { text: k }), h("span", { text: v })))))));

    root.append(
      viewHead("3 · The two frontends",
        "Both are Next.js 16 apps that render on the server. The public site only reads; the admin panel edits. Neither stores data: the backend does."),
      apps);

    for (const app of F.apps) {
      const tbody = h("tbody");
      app.pages.forEach((page, i) => {
        const tr = h("tr", { class: "row-btn" },
          h("td", {}, code(page.route)),
          h("td", {}, h("div", { class: "chips" }, page.calls.map((c) => h("span", { class: "tag", text: c })))));
        pressable(tr, () => showPage(app, i));
        rows.set(`${app.id}:${i}`, tr);
        tbody.append(tr);
      });
      root.append(section(`${app.title}: every page and what it calls`, "Click a page to see the backend route and the file that handles it.",
        h("div", { class: "card table-wrap" }, h("table", { class: "grid" }, h("thead", {}, h("tr", {}, h("th", { text: "Page" }), h("th", { text: app.functions ? "Data functions (src/api)" : "Backend calls" }))), tbody)),
        app.unused?.length
          ? h("div", { class: "warn-box", style: { "margin-top": "12px" } }, h("b", { text: "Not used: " }), app.unused.map(([what, why]) => [code(what), ". ", why]))
          : null,
        app.kit
          ? h("div", { style: { "margin-top": "16px" } }, h("h3", { text: "Form kit (src/components/form)", style: { "margin-bottom": "8px" } }),
            h("div", { class: "mini-list" }, app.kit.map(([k, v]) => h("div", {}, h("b", { text: k }), h("span", { text: v })))))
          : null,
        h("div", { style: { "margin-top": "16px" } }, h("h3", { text: "Folders", style: { "margin-bottom": "8px" } }),
          h("div", { class: "card table-wrap" }, h("table", { class: "grid" }, h("tbody", {}, app.folders.map(([f, d]) => h("tr", {}, h("td", {}, code(f)), h("td", { text: d })))))))));
    }
    root.append(section("Shared between the two", null,
      h("div", { class: "card table-wrap" }, h("table", { class: "grid" }, h("tbody", {}, F.shared.map(([k, v]) => h("tr", {}, h("td", {}, h("b", { text: k })), h("td", { text: v }))))))));

    return {
      select(arg) {
        const [appId, idx] = arg.split(":");
        const app = F.apps.find((a) => a.id === appId);
        if (app && app.pages[Number(idx)]) {
          rows.get(arg)?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
          showPage(app, Number(idx));
        }
      },
    };
  }

  // ================================================================ 4 · DATABASE
  function databaseView(root) {
    const D = A.database;
    const CARD_W = 210;
    const CARD_H = 48;
    const MAP = { w: 1800, h: 1110 };
    const kindOf = (onDelete) => ({ CASCADE: "cascade", RESTRICT: "restrict", "SET NULL": "setnull" })[onDelete] || "restrict";

    const tables = new Map();
    for (const t of [...A.dbSchema.tables, ...D.extraTables]) {
      const meta = D.tables[t.name] || {};
      tables.set(t.name, { ...t, group: meta.group || "links", meta, pos: D.layout[t.name] || [0, 0] });
    }
    const rels = [];
    for (const t of tables.values()) {
      for (const fk of t.foreignKeys) rels.push({ from: t.name, col: fk.columns[0], to: fk.table, refCol: fk.refColumns[0], onDelete: fk.onDelete });
    }
    const outgoing = (name) => rels.filter((r) => r.from === name);
    const incoming = (name) => rels.filter((r) => r.to === name && r.from !== name);

    // Link tables: the owner side cascades, the picked side is restricted.
    const m2m = [];
    for (const t of tables.values()) {
      if (t.group !== "links") continue;
      const fks = outgoing(t.name);
      const owner = fks.find((r) => r.onDelete === "CASCADE") || fks[0];
      const target = fks.find((r) => r !== owner) || fks[1];
      m2m.push({ via: t.name, from: owner.to, to: target.to });
      const uniqueMedia = t.uniques.some((u) => u.columns.length === 1 && u.columns[0] === target.col);
      t.meta = {
        what: `Links ${owner.to} to ${target.to}: one row per pair, and position keeps the order chosen in the form. ` +
          `Deleting a row in ${owner.to} deletes its rows here (CASCADE); a row in ${target.to} can't be deleted while it is linked (RESTRICT).` +
          (uniqueMedia ? ` ${target.col} is unique: a file belongs to one ${owner.to.replace(/s$/, "")} only.` : ""),
        managedBy: [owner.to === "tech_stacks" ? "services/selectors.py · SelectorService" : "services/content.py", "repositories/links.py · replace_links()"],
        shownIn: [`Admin: the ${owner.to.replace(/_/g, " ")} form's ${target.to.replace(/_/g, " ")} picker`],
      };
    }

    let mode = "entities";
    let focus = null;
    let selected = null;
    let groupOn = null;
    let cardEls = new Map();
    let relEls = [];

    // ---- toolbar + canvas
    const modeSeg = h("div", { class: "seg", role: "group", "aria-label": "Map mode" });
    const entityCount = [...tables.values()].filter((t) => t.group !== "links").length;
    for (const [id, label] of [["entities", `Entities (${entityCount})`], ["all", `All tables (${tables.size})`]]) {
      modeSeg.append(h("button", { type: "button", "data-mode": id, onclick: () => {
        mode = id;
        focus = null;
        render();
      } }, label));
    }
    const groupChips = h("div", { class: "chips" }, Object.entries(D.groups).map(([id, g]) =>
      pressable(h("span", { class: "chip", "data-group": id, style: { "--c": cssVar(g.color) } }, h("span", { class: "dot" }), g.label), () => {
        groupOn = groupOn === id ? null : id;
        if (focus) {
          focus = null;
          render();
        } else paint();
      })));
    const backBtn = h("button", { class: "btn", type: "button", onclick: () => {
      focus = null;
      render();
    } }, "← Back to the map");
    const focusLabel = h("span", { class: "hint" });
    const toolbar = h("div", { class: "toolbar" }, modeSeg, backBtn, focusLabel, groupChips);
    const svg = s("svg", { class: "db-svg", role: "img", "aria-label": "Database map" });
    const zoomBox = h("div", { class: "zoom" },
      h("button", { class: "icon-btn", type: "button", "aria-label": "Zoom in", onclick: () => zoom(0.8) }, "+"),
      h("button", { class: "icon-btn", type: "button", "aria-label": "Zoom out", onclick: () => zoom(1.25) }, "−"),
      h("button", { class: "icon-btn", type: "button", "aria-label": "Fit to screen", onclick: () => fit() }, "⤢"));
    const relLegend = h("div", { class: "legend" },
      Object.entries({ cascade: "ON DELETE CASCADE (owner → its rows)", restrict: "ON DELETE RESTRICT (can't delete while used)", setnull: "ON DELETE SET NULL", m2m: "many-to-many (through a link table)" })
        .map(([k, label]) => h("span", {}, h("i", { class: "line" + (k === "setnull" || k === "m2m" ? " dash" : ""), style: { "--c": cssVar(`--r-${k}`) } }), label)),
      h("span", { class: "hint", text: "Click a table for details · double-click or Focus to see its neighbours · drag to move · Ctrl + wheel to zoom" }));
    const stage = h("div", { class: "card canvas-card db-stage" }, h("div", { class: "scroll-x" }, svg), zoomBox, relLegend);

    // ---- pan + zoom (viewBox)
    let base = { x: 0, y: 0, w: MAP.w, h: MAP.h };
    let vb = { ...base };
    const applyVB = () => svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const fit = () => {
      vb = { ...base };
      applyVB();
    };
    function zoom(factor, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) {
      const w = Math.min(base.w * 2.5, Math.max(base.w / 6, vb.w * factor));
      const k = w / vb.w;
      vb = { x: cx - (cx - vb.x) * k, y: cy - (cy - vb.y) * k, w, h: vb.h * k };
      applyVB();
    }
    svg.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      zoom(e.deltaY > 0 ? 1.15 : 0.87, vb.x + ((e.clientX - r.left) / r.width) * vb.w, vb.y + ((e.clientY - r.top) / r.height) * vb.h);
    }, { passive: false });
    let drag = null;
    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.pointerType === "touch" || e.target.closest(".tcard")) return;
      drag = { x: e.clientX, y: e.clientY, start: { ...vb }, moved: false };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const k = vb.w / svg.getBoundingClientRect().width;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) {
        drag.moved = true;
        svg.classList.add("grabbing");
      }
      vb = { ...drag.start, x: drag.start.x - (e.clientX - drag.x) * k, y: drag.start.y - (e.clientY - drag.y) * k };
      applyVB();
    });
    const endDrag = () => {
      if (drag && !drag.moved) {
        groupOn = null;
        closeDetail();
        paint();
      }
      drag = null;
      svg.classList.remove("grabbing");
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", () => {
      drag = null;
      svg.classList.remove("grabbing");
    });

    // ---- drawing helpers
    function relPath(a, b) {
      const [ax, ay] = a.pos;
      const [bx, by] = b.pos;
      if (a === b) {
        const x = ax + CARD_W;
        const y = ay + CARD_H / 2;
        return `M${x},${y - 10} C${x + 60},${y - 46} ${x + 60},${y + 46} ${x + 5},${y + 10}`;
      }
      const acx = ax + CARD_W / 2;
      const bcx = bx + CARD_W / 2;
      if (Math.abs(acx - bcx) < 60) {
        const x1 = ax;
        const y1 = ay + CARD_H / 2;
        const x2 = bx;
        const y2 = by + CARD_H / 2;
        const bulge = 46 + Math.min(40, Math.abs(y2 - y1) * 0.06);
        return `M${x1},${y1} C${x1 - bulge},${y1} ${x2 - bulge},${y2} ${x2 - 5},${y2}`;
      }
      const ltr = bcx > acx;
      const x1 = ltr ? ax + CARD_W : ax;
      const y1 = ay + CARD_H / 2;
      const x2 = ltr ? bx : bx + CARD_W;
      const y2 = by + CARD_H / 2;
      const k = Math.max(50, Math.abs(x2 - x1) * 0.45) * (ltr ? 1 : -1);
      return `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2 - (ltr ? 5 : -5)},${y2}`;
    }
    const metaLine = (t) => {
      const out = outgoing(t.name).length;
      const inc = incoming(t.name).length;
      return `${t.columns.length} columns` + (out ? ` · ${out} FK out` : "") + (inc ? ` · ${inc} in` : "");
    };
    function tableCard(t, x, y, w, hgt, label, sub) {
      const g = s("g", { class: "tcard", style: { "--c": cssVar(D.groups[t.group].color) }, "aria-label": `Table ${t.name}` },
        s("rect", { class: "box", x, y, width: w, height: hgt, rx: 10 }),
        s("rect", { class: "bar", x: x + 9, y: y + 12, width: 4, height: hgt - 24, rx: 2 }),
        s("text", { class: "name", x: x + 22, y: y + hgt / 2 - 3, text: label }),
        s("text", { class: "meta", x: x + 22, y: y + hgt / 2 + 13, text: sub }));
      return g;
    }

    // ---- the map
    function renderMap() {
      svg.replaceChildren(markers("db"));
      cardEls = new Map();
      relEls = [];
      const visible = [...tables.values()].filter((t) => mode === "all" || t.group !== "links");
      const isVisible = new Set(visible.map((t) => t.name));
      const zoneLayer = s("g");
      const relLayer = s("g");
      const cardLayer = s("g");
      for (const z of D.zones) {
        const members = z.tables.filter((n) => isVisible.has(n));
        if (!members.length) continue;
        const xs = members.map((n) => tables.get(n).pos[0]);
        const ys = members.map((n) => tables.get(n).pos[1]);
        const x = Math.min(...xs) - 18;
        const y = Math.min(...ys) - 40;
        zoneLayer.append(s("g", { class: "zone", style: { "--c": cssVar(D.groups[z.group].color) } },
          s("rect", { x, y, width: Math.max(...xs) + CARD_W + 18 - x, height: Math.max(...ys) + CARD_H + 18 - y, rx: 18 }),
          s("text", { x: x + 16, y: y + 24, text: z.label })));
      }
      const list = mode === "all"
        ? rels.map((r) => ({ ...r, kind: kindOf(r.onDelete) }))
        : [
          ...rels.filter((r) => isVisible.has(r.from) && isVisible.has(r.to)).map((r) => ({ ...r, kind: kindOf(r.onDelete) })),
          ...m2m.map((m) => ({ from: m.from, to: m.to, via: m.via, kind: "m2m" })),
        ];
      for (const r of list) {
        const el = s("path", { class: `rel ${r.kind}`, d: relPath(tables.get(r.from), tables.get(r.to)), "marker-end": "url(#db-arrow)" },
          s("title", { text: r.via ? `${r.from} ⇄ ${r.to} (through ${r.via})` : `${r.from}.${r.col} → ${r.to} (ON DELETE ${r.onDelete})` }));
        if (r.kind === "m2m") el.setAttribute("marker-start", "url(#db-arrow)");
        relLayer.append(el);
        relEls.push({ el, r });
      }
      for (const t of visible) {
        const [x, y] = t.pos;
        const g = tableCard(t, x, y, CARD_W, CARD_H, t.name, metaLine(t));
        pressable(g, (ev) => {
          ev.stopPropagation();
          selectTable(t.name);
        });
        g.addEventListener("dblclick", (ev) => {
          ev.stopPropagation();
          openFocus(t.name);
        });
        g.addEventListener("mouseenter", () => paint(t.name));
        g.addEventListener("mouseleave", () => paint());
        cardLayer.append(g);
        cardEls.set(t.name, g);
      }
      svg.append(zoneLayer, relLayer, cardLayer);
      base = { x: 0, y: 0, w: MAP.w, h: MAP.h };
      fit();
      paint();
    }

    /** Highlight a table and its neighbours (hover), else the selection, else the chosen group. */
    function paint(hover = null) {
      const name = hover || selected;
      if (name && cardEls.has(name)) {
        const near = new Set([name]);
        for (const { r } of relEls) if (r.from === name || r.to === name) near.add(r.from).add(r.to);
        for (const [n, g] of cardEls) {
          g.classList.toggle("on", n === name);
          g.classList.toggle("dim", !near.has(n));
        }
        for (const { el, r } of relEls) {
          const hit = r.from === name || r.to === name;
          el.classList.toggle("on", hit);
          el.classList.toggle("dim", !hit);
        }
      } else if (groupOn) {
        const inGroup = (n) => tables.get(n).group === groupOn;
        for (const [n, g] of cardEls) {
          g.classList.remove("on");
          g.classList.toggle("dim", !inGroup(n));
        }
        for (const { el, r } of relEls) {
          const hit = inGroup(r.from) || inGroup(r.to);
          el.classList.toggle("on", hit);
          el.classList.toggle("dim", !hit);
        }
      } else {
        for (const g of cardEls.values()) g.classList.remove("on", "dim");
        for (const { el } of relEls) el.classList.remove("on", "dim");
      }
      $$(".chip[data-group]", groupChips).forEach((c) => c.classList.toggle("off", !!groupOn && c.dataset.group !== groupOn));
    }

    // ---- focus: one table with its columns and every neighbour
    function renderFocus(name) {
      svg.replaceChildren(markers("db"));
      cardEls = new Map();
      relEls = [];
      const t = tables.get(name);
      const out = outgoing(name);
      const inc = incoming(name);
      const ROW = 24;
      const HEAD = 58;
      const CW = 380;
      const NB_W = 260;
      const NB_H = 58;
      const GAP = 16;
      const W = 1300;
      const centerH = HEAD + t.columns.length * ROW + 12;
      const colH = (n) => n * NB_H + Math.max(0, n - 1) * GAP;
      const H = Math.max(centerH, colH(inc.length), colH(out.length)) + 100;
      const cx = (W - CW) / 2;
      const cy = 60 + (H - 100 - centerH) / 2;
      const relLayer = s("g");
      const cardLayer = s("g");

      const center = s("g", { class: "tcard on focus-col", style: { "--c": cssVar(D.groups[t.group].color) } },
        s("rect", { class: "box", x: cx, y: cy, width: CW, height: centerH, rx: 14 }),
        s("text", { class: "name", x: cx + 18, y: cy + 27, text: t.name, style: { "font-size": "15px" } }),
        s("text", { class: "meta", x: cx + 18, y: cy + 46, text: `${D.groups[t.group].label}${t.model ? " · model " + t.model : ""} · ${t.columns.length} columns` }));
      const rowY = {};
      t.columns.forEach((c, i) => {
        const y = cy + HEAD + i * ROW;
        rowY[c.name] = y + ROW / 2;
        if (i % 2 === 0) center.append(s("rect", { class: "row alt", x: cx + 1, y, width: CW - 2, height: ROW }));
        const flag = c.pk ? "PK" : c.fk ? "FK" : c.unique ? "UQ" : "";
        if (flag) center.append(s("text", { class: `flag flag-${flag.toLowerCase()}`, x: cx + 14, y: y + 16, text: flag }));
        center.append(s("text", { class: "col", x: cx + 44, y: y + 16, text: c.name + (c.nullable ? " ?" : "") }));
        center.append(s("text", { class: "type", x: cx + CW - 14, y: y + 16, "text-anchor": "end", text: shortType(c.type) }));
      });
      pressable(center, (ev) => {
        ev.stopPropagation();
        selectTable(name);
      });
      cardLayer.append(center);

      const place = (list, side) => {
        let y = 60 + (H - 100 - colH(list.length)) / 2;
        cardLayer.append(s("text", { class: "t-small", x: side === "left" ? 60 : W - 60 - NB_W, y: Math.min(y, cy) - 14,
          text: list.length ? (side === "left" ? "Used by (their key points here)" : "Points to") : "" }));
        for (const r of list) {
          const other = side === "left" ? r.from : r.to;
          const self = other === name;
          const ot = tables.get(other);
          const x = side === "left" ? 60 : W - 60 - NB_W;
          const sub = side === "left" ? `${r.col} → ${r.refCol} · ${r.onDelete}` : `via ${r.col} · ${r.onDelete}`;
          const card = tableCard(ot, x, y, NB_W, NB_H, self ? `${other} (itself)` : other, sub);
          pressable(card, (ev) => {
            ev.stopPropagation();
            if (!self) openFocus(other);
          });
          cardLayer.append(card);
          const kind = kindOf(r.onDelete);
          const d = side === "left"
            ? (() => {
              const x1 = x + NB_W;
              const y1 = y + NB_H / 2;
              const y2 = rowY[r.refCol] ?? cy + HEAD / 2;
              return `M${x1},${y1} C${x1 + 80},${y1} ${cx - 80},${y2} ${cx - 5},${y2}`;
            })()
            : (() => {
              const x1 = cx + CW;
              const y1 = rowY[r.col];
              const y2 = y + NB_H / 2;
              return `M${x1},${y1} C${x1 + 80},${y1} ${x - 80},${y2} ${x - 5},${y2}`;
            })();
          relLayer.append(s("path", { class: `rel on ${kind}`, d, "marker-end": "url(#db-arrow)" }));
          y += NB_H + GAP;
        }
      };
      place(inc, "left");
      place(out, "right");
      if (!inc.length && !out.length) {
        cardLayer.append(s("text", { class: "t-sub", x: W / 2, y: cy + centerH + 34, "text-anchor": "middle", text: "No foreign keys in or out: this table stands alone." }));
      }
      svg.append(relLayer, cardLayer);
      base = { x: 0, y: 0, w: W, h: Math.max(H, 520) };
      fit();
    }

    function render() {
      $$("button", modeSeg).forEach((b) => b.classList.toggle("on", b.dataset.mode === mode && !focus));
      backBtn.hidden = !focus;
      focusLabel.textContent = focus ? `Focus: ${focus} — click a neighbour to walk the graph` : "";
      groupChips.hidden = !!focus;
      if (focus) renderFocus(focus);
      else renderMap();
    }
    function openFocus(name) {
      focus = name;
      groupOn = null;
      render();
      selectTable(name);
      stage.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }

    // ---- details of one table
    const tableLink = (name) => h("button", { class: "link-btn", type: "button", onclick: () => (focus ? openFocus(name) : selectTable(name)) }, name);
    function colNotes(c) {
      return h("div", { class: "chips" },
        c.pk ? h("span", { class: "tag pk", text: "PK" }) : null,
        c.fk ? [h("span", { class: "tag fk", text: "FK" }), " → ", tableLink(c.fk.table)] : null,
        c.unique ? h("span", { class: "tag uq", text: "unique" }) : null,
        c.nullable ? h("span", { class: "tag", text: "optional" }) : null,
        c.default ? h("span", { class: "tag", text: `default ${c.default}` }) : null,
        c.onUpdate ? h("span", { class: "tag", text: `on update ${c.onUpdate}` }) : null);
    }
    function selectTable(name) {
      const t = tables.get(name);
      if (!t) return;
      selected = name;
      if (!focus) {
        if (!cardEls.has(name)) {
          mode = "all";
          render();
        }
        paint();
      }
      const outs = outgoing(name);
      const ins = incoming(name);
      const grp = D.groups[t.group];
      openDetail(`${grp.label} · table`, name, [
        h("p", { class: "what", text: t.meta.what || t.doc || "" }),
        kv([
          t.model ? ["Model", h("span", {}, code(t.model), " in ", code(t.module))] : ["Defined in", code(t.module)],
          t.meta.managedBy ? ["Managed by", bullets(t.meta.managedBy)] : null,
          t.meta.shownIn ? ["Shown in", bullets(t.meta.shownIn)] : null,
        ]),
        focus !== name ? h("div", { class: "toolbar" }, h("button", { class: "btn primary", type: "button", onclick: () => openFocus(name) }, "Focus on this table")) : null,
        block(`Columns (${t.columns.length})`, h("div", { class: "table-wrap" }, h("table", { class: "grid" },
          h("thead", {}, h("tr", {}, ["Column", "Type", "Notes"].map((x) => h("th", { text: x })))),
          h("tbody", {}, t.columns.map((c) => h("tr", {}, h("td", {}, code(c.name)), h("td", {}, h("span", { class: "tag", text: shortType(c.type) })), h("td", {}, colNotes(c)))))))),
        outs.length ? block("Points to", bullets(outs.map((r) => h("span", {}, code(r.col), " → ", tableLink(r.to), ` · ON DELETE ${r.onDelete}. `, h("span", { class: "hint", text: D.onDelete[r.onDelete] || "" }))))) : null,
        ins.length ? block("Used by", bullets(ins.map((r) => h("span", {}, tableLink(r.from), code("." + r.col), ` · ON DELETE ${r.onDelete}`)))) : null,
        t.checks.length ? block("Rules (CHECK)", bullets(t.checks.map((c) => h("span", {}, h("b", { text: D.checks[c.name] || c.name }), h("br"), code(c.sql))))) : null,
        t.uniques.length || t.indexes.length
          ? block("Unique rules and indexes", bullets([
            ...t.uniques.map((u) => h("span", {}, "unique ", code(u.columns.join(", ")), " ", h("span", { class: "hint", text: u.name }))),
            ...t.indexes.map((i) => h("span", {}, i.unique ? "unique index " : "index ", code(i.columns.join(", ")), i.where ? [" where ", code(i.where)] : null, " ", h("span", { class: "hint", text: i.name }))),
          ]))
          : null,
      ], () => {
        selected = null;
        if (!focus) paint();
        setArg("database");
      });
      setArg("database", name);
    }

    // ---- rules and other objects (below the map)
    const deleteCounts = {};
    for (const r of rels) deleteCounts[r.onDelete] = (deleteCounts[r.onDelete] || 0) + 1;
    const allChecks = [...tables.values()].flatMap((t) => t.checks.map((c) => ({ table: t.name, ...c })));

    root.append(
      viewHead("4 · The database",
        `PostgreSQL, schema work: ${tables.size} tables, ${rels.length} foreign keys, ${allChecks.length} CHECK rules. Start with the entities, switch to all tables to see the link tables, focus a table to walk its neighbours.`),
      toolbar,
      h("div", { style: { height: "10px" } }),
      stage,
      section("What happens on delete", "Every foreign key says what PostgreSQL does when the row it points to is deleted.",
        h("div", { class: "objects" }, Object.entries(D.onDelete).map(([k, text]) =>
          h("div", { class: "card obj", style: { "--c": cssVar(`--r-${kindOf(k)}`) } },
            h("div", { class: "count", text: String(deleteCounts[k] || 0) }), h("h3", { text: k }), h("p", { text })))),
        h("p", { class: "hint", style: { "margin-top": "10px" }, text: "Pattern: a link table cascades from its owner (deleting a project removes its links) and restricts the picked item (a technology in use can't be deleted)." })),
      section("CHECK rules", "Rules the database itself enforces, even if a bug in the code tried to break them.",
        h("div", { class: "rules" }, allChecks.map((c) => h("div", { class: "card rule" },
          h("button", { type: "button", onclick: () => selectTable(c.table) }, c.table),
          h("p", { text: D.checks[c.name] || c.name }),
          code(c.sql))))),
      section("Other database objects", "What else lives in the schema, and why most of it is empty on purpose.",
        h("div", { class: "objects" }, D.objects.map((o) => h("div", { class: "card obj" },
          h("div", { class: "count" + (o.count ? "" : " zero"), text: String(o.count) }), h("h3", { text: o.name }), h("p", { text: o.text }))))),
      section("Conventions", null,
        h("div", { class: "card table-wrap" }, h("table", { class: "grid" }, h("tbody", {}, D.conventions.map(([k, v]) => h("tr", {}, h("td", {}, h("b", { text: k })), h("td", { text: v }))))))),
    );
    render();

    return {
      select(arg) {
        if (tables.has(arg)) openFocus(arg);
      },
    };
  }
  function shortType(type) {
    return type.replace("TIMESTAMP WITH TIME ZONE", "TIMESTAMPTZ").replace("CHARACTER VARYING", "VARCHAR");
  }

  // ================================================================ 5 · FLOWS
  function flowsView(root) {
    const flows = A.flows;
    let flow = flows[0];
    let step = 0;
    let timer = null;
    let msgEls = [];

    const list = h("div", { class: "flow-list" });
    const svgWrap = h("div", { class: "card canvas-card scroll-x" });
    const box = h("div", { class: "card step-box", "aria-live": "polite" });
    const bar = h("i");
    const counter = h("span", { class: "hint" });
    const prevBtn = h("button", { class: "btn", type: "button", onclick: () => go_(step - 1) }, "← Back");
    const nextBtn = h("button", { class: "btn primary", type: "button", onclick: () => go_(step + 1) }, "Next →");
    const playBtn = h("button", { class: "btn", type: "button", onclick: togglePlay }, "▶ Play");
    for (const f of flows) {
      list.append(h("button", { type: "button", "data-id": f.id, onclick: () => choose(f.id) }, f.title, h("small", { text: `${f.steps.length} steps · ${f.lanes.join(" · ")}` })));
    }
    root.append(
      viewHead("5 · Journeys, step by step",
        "Each journey is drawn as a sequence diagram: columns are the parts of the system, arrows are messages in time order. Use Next / Back (or ← →), or Play."),
      h("div", { class: "flow-layout" }, list,
        h("div", {}, svgWrap, h("div", { class: "step-controls" }, prevBtn, nextBtn, playBtn, h("div", { class: "progress" }, bar), counter), box)));

    function draw() {
      const W = 1000;
      const n = flow.lanes.length;
      const top = 24;
      const headH = 40;
      const rowH = 50;
      const laneX = (i) => 100 + (i * (W - 200)) / Math.max(1, n - 1);
      const H = top + headH + 34 + flow.steps.length * rowH;
      const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "seq", role: "img", "aria-label": flow.title });
      svg.append(markers("seq"));
      const laneW = Math.min(170, (W - 200) / Math.max(1, n - 1) - 14);
      flow.lanes.forEach((name, i) => {
        const x = laneX(i);
        svg.append(s("line", { class: "lifeline", x1: x, y1: top + headH, x2: x, y2: H - 8 }),
          s("g", { class: "lane-head" }, s("rect", { x: x - laneW / 2, y: top, width: laneW, height: headH, rx: 10 }), s("text", { x, y: top + 25, "text-anchor": "middle", text: name })));
      });
      msgEls = flow.steps.map(([a, b, label], i) => {
        const y = top + headH + 44 + i * rowH;
        const g = s("g", { class: "msg" + (a === b ? " self" : "") });
        const tw = textWidth(label, 12, 0.6);
        if (a === b) {
          const bw = tw + 44;
          const bx = Math.max(6, Math.min(W - 6 - bw, laneX(a) - bw / 2));
          g.append(s("rect", { x: bx, y: y - 19, width: bw, height: 30, rx: 8 }),
            s("text", { class: "n", x: bx + 12, y: y + 1, text: String(i + 1) }),
            s("text", { x: bx + 30, y: y + 1, text: label }));
        } else {
          const x1 = laneX(a);
          const x2 = laneX(b);
          const dir = Math.sign(x2 - x1);
          g.append(s("line", { x1, y1: y + 4, x2: x2 - dir * 4, y2: y + 4, "marker-end": "url(#seq-arrow)" }));
          const lx = Math.max(6, Math.min(W - 6 - tw - 18, (x1 + x2) / 2 - (tw + 18) / 2));
          g.append(s("text", { class: "n", x: lx, y: y - 6, text: String(i + 1) }), s("text", { x: lx + 18, y: y - 6, text: label }));
        }
        pressable(g, () => {
          stop();
          go_(i);
        });
        svg.append(g);
        return g;
      });
      svgWrap.replaceChildren(svg);
    }
    function go_(i) {
      step = Math.max(0, Math.min(flow.steps.length - 1, i));
      msgEls.forEach((g, k) => {
        g.classList.toggle("on", k === step);
        g.classList.toggle("future", k > step);
      });
      const [a, b, label, text] = flow.steps[step];
      box.replaceChildren(
        h("div", { class: "k", text: `Step ${step + 1} of ${flow.steps.length} · ${a === b ? flow.lanes[a] : `${flow.lanes[a]} → ${flow.lanes[b]}`}` }),
        h("h3", { text: label }),
        h("p", { text }));
      counter.textContent = `${step + 1} / ${flow.steps.length}`;
      bar.style.width = `${((step + 1) / flow.steps.length) * 100}%`;
      prevBtn.disabled = step === 0;
      nextBtn.disabled = step === flow.steps.length - 1;
    }
    function choose(id) {
      stop();
      flow = flows.find((f) => f.id === id) || flows[0];
      $$("button", list).forEach((b) => b.classList.toggle("on", b.dataset.id === flow.id));
      draw();
      go_(0);
      setArg("flows", flow.id);
    }
    function togglePlay() {
      if (timer) return stop();
      if (step >= flow.steps.length - 1) go_(0);
      playBtn.textContent = "❚❚ Pause";
      timer = setInterval(() => (step >= flow.steps.length - 1 ? stop() : go_(step + 1)), 2800);
    }
    function stop() {
      clearInterval(timer);
      timer = null;
      playBtn.textContent = "▶ Play";
    }
    const onKey = (e) => {
      if (e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go_(step + 1);
      if (e.key === "ArrowLeft") go_(step - 1);
    };
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
      stop();
      document.removeEventListener("keydown", onKey);
    });
    choose(flows[0].id);
    return { select: (id) => choose(id) };
  }

  // ---------------------------------------------------------------- search
  function buildIndex() {
    const items = [];
    for (const n of A.system.nodes) items.push({ label: n.title, kind: "System", terms: `${n.title} ${n.sub} ${n.folder || ""}`, go: () => go("overview", n.id) });
    const seen = new Set();
    for (const group of [...A.backend.layers, ...A.backend.side]) {
      for (const [path, desc] of group.files) {
        if (seen.has(path)) continue;
        seen.add(path);
        items.push({ label: path, kind: "Backend", terms: `${path} ${desc}`, go: () => go("backend", path) });
      }
    }
    for (const app of A.frontends.apps) {
      app.pages.forEach((p, i) => items.push({ label: p.route, kind: app.title, terms: `${p.route} ${p.file} ${p.calls.join(" ")}`, go: () => go("frontends", `${app.id}:${i}`) }));
    }
    for (const t of [...A.dbSchema.tables, ...A.database.extraTables]) {
      items.push({ label: t.name, kind: "Table", terms: `${t.name} ${t.model || ""} ${t.columns.map((c) => c.name).join(" ")}`, go: () => go("database", t.name) });
    }
    for (const f of A.flows) items.push({ label: f.title, kind: "Flow", terms: f.title, go: () => go("flows", f.id) });
    return items;
  }
  function setupSearch() {
    const input = document.getElementById("search");
    const box = document.getElementById("search-results");
    const index = buildIndex();
    let results = [];
    let active = 0;
    const close = () => {
      box.hidden = true;
    };
    const pick = (item) => {
      close();
      input.value = "";
      input.blur();
      item.go();
    };
    const draw = () => {
      box.replaceChildren();
      if (!results.length) box.append(h("div", { class: "empty", text: "Nothing found" }));
      results.forEach((item, i) => box.append(h("button", { type: "button", class: i === active ? "on" : "", role: "option", onmousedown: (e) => {
        e.preventDefault();
        pick(item);
      } }, h("span", { text: item.label }), h("span", { class: "k", text: item.kind }))));
      box.hidden = false;
    };
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (!q) return close();
      const score = (it) => (it.label.toLowerCase().startsWith(q) ? 0 : it.label.toLowerCase().includes(q) ? 1 : it.terms.toLowerCase().includes(q) ? 2 : 9);
      results = index.map((it) => [score(it), it]).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0]).slice(0, 12).map(([, it]) => it);
      active = 0;
      draw();
    });
    input.addEventListener("keydown", (e) => {
      if (box.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        active = (active + (e.key === "ArrowDown" ? 1 : results.length - 1)) % Math.max(1, results.length);
        draw();
      } else if (e.key === "Enter" && results[active]) pick(results[active]);
      else if (e.key === "Escape") close();
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !e.target.closest("input, textarea")) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  // ---------------------------------------------------------------- start
  document.getElementById("theme").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("arch-theme", next);
    } catch (e) {
      /* private mode: the choice just isn't remembered */
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
  });
  document.getElementById("checked-on").textContent = CHECKED_ON;
  setupSearch();
  window.addEventListener("hashchange", route);
  route();
})();
