/* MIT © 2026 LydiaTools. */
(function () {
  "use strict";
  const MAX_REPORT = 8 * 1024 * 1024;
  const MAX_FILE = 20 * 1024 * 1024;
  const verdicts = ["unreviewed", "followup", "prototype", "pass"];
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  function requireValue(ok, message) { if (!ok) throw new Error(message); }
  function string(v, max = 1000) { return typeof v === "string" && v.length <= max; }
  function integer(v) { return Number.isSafeInteger(v) && v >= 0; }
  function github(value) {
    if (!string(value, 1500)) return null;
    try {
      const u = new URL(value);
      return u.protocol === "https:" && u.hostname === "github.com" && !u.username && !u.password && !u.port ? u.href : null;
    } catch { return null; }
  }
  function external(value) {
    if (!string(value, 1500)) return null;
    try {
      const u = new URL(value);
      return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
    } catch { return null; }
  }
  function hn(value) {
    const safe = external(value);
    if (!safe) return null;
    const u = new URL(safe);
    return u.protocol === "https:" && u.hostname === "news.ycombinator.com" && !u.port && u.pathname === "/item" && /^[1-9][0-9]*$/.test(u.searchParams.get("id") || "") ? u.href : null;
  }
  const source = value => github(value) || hn(value);
  const records = report => report.schema_version === 2 ? report.threads : report.issues;
  function body(v) {
    requireValue(object(v) && string(v.text, 16000) && typeof v.truncated === "boolean" && integer(v.characters), "Invalid source excerpt.");
    requireValue([...v.text].length <= v.characters, "Excerpt length does not match its source count.");
  }
  function validate(report) {
    requireValue(object(report) && report.tool === "GapCue" && [1, 2].includes(report.schema_version), "Choose a supported GapCue report.");
    const isHN = report.schema_version === 2;
    requireValue(!isHN || report.source_kind === "hackernews", "Unsupported report source.");
    requireValue(typeof report.synthetic === "boolean" && string(report.captured_at, 100) && Number.isFinite(Date.parse(report.captured_at)), "Missing collection date or sample flag.");
    requireValue(["complete", "partial"].includes(report.collection_status), "Invalid collection status.");
    requireValue(Array.isArray(records(report)) && records(report).length <= 6 && Array.isArray(report.repositories) && report.repositories.length <= 50, "Report exceeds the supported issue/repository bounds.");
    requireValue(Array.isArray(report.failures) && report.failures.length <= 200 && report.failures.every(x => string(x, 1000)), "Invalid source failures.");
    requireValue(report.collection_status !== "complete" || !report.failures.length, "A report with unavailable sources must be marked partial.");
    requireValue(Array.isArray(report.requests) && report.requests.length <= 200, "Invalid request list.");
    if (object(report.discovery) && Object.prototype.hasOwnProperty.call(report.discovery, "repository_context")) {
      const origin = report.discovery.repository_context;
      requireValue(isHN && object(origin) && string(origin.full_name, 230) && /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(origin.full_name), "Invalid repository search origin.");
      const safe = github(origin.url);
      requireValue(safe && origin.relation === "name_search_unverified" && report.threads.length === 1 && object(report.threads[0]) && report.discovery.selected_id === report.threads[0].number, "Invalid repository search origin.");
      const url = new URL(safe);
      requireValue(url.pathname.toLowerCase() === ("/" + origin.full_name).toLowerCase() && !url.search && !url.hash, "Invalid repository search origin.");
    }
    const keys = new Set();
    for (const issue of records(report)) {
      requireValue(object(issue) && string(issue.key, 230) && (isHN ? /^hn#[1-9][0-9]*$/ : /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+#[1-9][0-9]*$/).test(issue.key), "Invalid issue key.");
      requireValue(!keys.has(issue.key.toLowerCase()), "Duplicate issue key."); keys.add(issue.key.toLowerCase());
      requireValue(typeof issue.available === "boolean" && (report.synthetic && issue.url === null || (isHN ? hn(issue.url) : github(issue.url))), "Invalid issue source URL.");
      if (isHN) requireValue(issue.source_kind === "hackernews" && integer(issue.number) && issue.number > 0 && issue.key === "hn#" + issue.number && issue.key === "hn#" + new URL(issue.url).searchParams.get("id"), "Invalid HN thread identity.");
      if (!issue.available) { requireValue(string(issue.error, 1000), "Missing source error."); continue; }
      requireValue(string(issue.title, 1000) && string(issue.author, 200) && (isHN ? issue.state === "discussion" && integer(issue.points) : ["open", "closed"].includes(issue.state)), "Invalid issue details.");
      requireValue(string(issue.created_at, 100) && string(issue.updated_at, 100), "Invalid issue dates.");
      body(issue.body);
      const comments = issue.comments;
      requireValue(object(comments) && typeof comments.available === "boolean" && integer(comments.reported_total) && Array.isArray(comments.entries) && comments.entries.length <= 40 && Array.isArray(comments.pages) && comments.pages.length <= 2 && comments.pages.every(p => integer(p) && p > 0), "Invalid comment sample.");
      if (isHN) requireValue(comments.indexed_total === null || integer(comments.indexed_total), "Invalid HN index count.");
      const ids = new Set();
      for (const c of comments.entries) {
        requireValue(object(c) && integer(c.id) && !ids.has(c.id) && string(c.author, 200) && string(c.account_type, 100) && string(c.association, 100) && string(c.created_at, 100) && integer(c.page) && comments.pages.includes(c.page), "Invalid comment entry."); ids.add(c.id);
        requireValue(report.synthetic && c.url === null || (isHN ? hn(c.url) : github(c.url)), "Invalid comment source URL.");
        if (isHN) requireValue(c.id > 0 && new URL(c.url).searchParams.get("id") === String(c.id) && integer(c.parent_id) && c.parent_id > 0, "Invalid HN comment identity.");
        body(c.body);
      }
      requireValue(Array.isArray(issue.references) && issue.references.length <= 150, "Invalid mentioned references.");
      for (const ref of issue.references) {
        requireValue(object(ref) && (report.synthetic && ref.url === null || (isHN && ref.kind === "project_link" ? external(ref.url) : github(ref.url))) && ["checked", "unavailable", "not_checked", "link_only"].includes(ref.check), "Invalid reference check.");
        if (isHN) requireValue(ref.kind === "project_link" && ref.check === "link_only", "HN project links are not checked changes.");
        if (ref.check === "checked") requireValue(["issue", "pull_request"].includes(ref.kind) && ["open", "closed", "merged"].includes(ref.state) && (ref.state !== "merged" || ref.kind === "pull_request"), "Invalid collected reference state.");
      }
    }
    return report;
  }
  async function digest(text) {
    requireValue(globalThis.crypto?.subtle, "SHA-256 is unavailable. Open the viewer through HTTPS or file:// in Chrome.");
    const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2, "0")).join("");
  }
  async function parse(text) {
    requireValue(typeof text === "string" && new TextEncoder().encode(text).length <= MAX_FILE, "File exceeds 20 MiB.");
    const data = JSON.parse(text);
    let source = text, decisions = Object.create(null), expected;
    if (object(data) && data.tool === "GapCueReview") {
      requireValue(data.schema_version === 1 && string(data.source_text, MAX_REPORT) && object(data.decisions) && /^[0-9a-f]{64}$/.test(data.source_sha256 || ""), "Invalid review bundle.");
      source = data.source_text; expected = data.source_sha256;
      requireValue(Object.keys(data.decisions).length <= 6, "Too many review decisions.");
      for (const [key, value] of Object.entries(data.decisions)) {
        requireValue(object(value) && verdicts.includes(value.verdict) && string(value.notes, 6000) && string(value.updated_at, 100), "Invalid review decision.");
        decisions[key] = { verdict: value.verdict, notes: value.notes, updated_at: value.updated_at };
      }
    }
    requireValue(new TextEncoder().encode(source).length <= MAX_REPORT, "Source report exceeds 8 MiB.");
    const report = validate(source === text ? data : JSON.parse(source));
    const sha256 = await digest(source);
    requireValue(!expected || sha256 === expected, "The bundled source text no longer matches its SHA-256.");
    for (const key of Object.keys(decisions)) requireValue(records(report).some(i => i.key === key), "Review references an issue absent from the source report.");
    return { report, source, sha256, decisions };
  }
  function review(loaded, decisions) {
    const safe = Object.create(null);
    for (const issue of records(loaded.report)) {
      const d = decisions[issue.key];
      if (!d) continue;
      requireValue(verdicts.includes(d.verdict) && string(d.notes, 6000), "Invalid decision.");
      safe[issue.key] = { verdict: d.verdict, notes: d.notes, updated_at: d.updated_at };
    }
    return { schema_version: 1, tool: "GapCueReview", saved_at: new Date().toISOString(), source_sha256: loaded.sha256, source_text: loaded.source, decisions: safe };
  }
  const api = { MAX_REPORT, MAX_FILE, verdicts, github, hn, source, external, records, validate, digest, parse, review };
  if (typeof module === "object" && module.exports) module.exports = api;
  else globalThis.GapCueCore = api;
})();
