/**
 * Simulate DreamEngine happy-path + refine path (Node + window mock).
 * Exit 0 if all checks pass.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = __dirname;
const fails = [];

function assert(cond, msg) {
  if (!cond) fails.push(msg);
  console.log((cond ? "OK  " : "FAIL") + "  " + msg);
}

function loadBrowserScript(rel, sandbox) {
  const code = fs.readFileSync(path.join(root, rel), "utf8");
  vm.runInNewContext(code, sandbox, { filename: rel });
}

const window = {};
const sandbox = { window, console };
sandbox.global = sandbox;
sandbox.self = window;

loadBrowserScript("data/dreams.js", sandbox);
sandbox.DREAM_DB = window.DREAM_DB;
loadBrowserScript("js/engine.js", sandbox);

const { DreamEngine } = window;
assert(!!DreamEngine, "DreamEngine exported");
assert(!!window.DREAM_DB, "DREAM_DB loaded");

function logResult(label, result) {
  const phase = result.session && result.session.phase;
  const actionIds = (result.actions || []).map((a) => a.id);
  const hasImage = !!result.image;
  console.log(
    `[${label}] phase=${phase} actions=[${actionIds.join(",")}] hasImage=${hasImage}`
  );
  if (result.replies && result.replies.length) {
    const last = result.replies[result.replies.length - 1];
    console.log(`  lastReply: ${JSON.stringify(last).slice(0, 120)}`);
  }
  return result;
}

// --- Path A: dream → clarify×3 → feedback → yes → done ---
let session = DreamEngine.createSession();
assert(session.phase === "await_dream", "start phase await_dream");

let r = logResult(
  "dream",
  DreamEngine.processUserMessage(
    session,
    "Мне приснилось свадебное платье и мой муж рядом на церемонии"
  )
);
session = r.session;
assert(session.phase === "clarify", "after dream → clarify");
assert(session.symbols.length > 0, "symbols detected for wedding/dress/husband");

const clarifications = [
  "Я была в платье, муж рядом",
  "Атмосфера была радостная",
  "Рядом были близкие друзья"
];

for (let i = 0; i < clarifications.length; i++) {
  r = logResult(`clarify${i + 1}`, DreamEngine.processUserMessage(session, clarifications[i]));
  session = r.session;
}

assert(session.phase === "feedback", 'after 3 clarifications → phase "feedback"');
const lastReply = (r.replies || [])[r.replies.length - 1] || "";
assert(
  /удовлетвор|устраивает/i.test(lastReply),
  'last reply asks about удовлетворённость/устраивает'
);
assert(
  (r.actions || []).some((a) => a.id === "feedback_yes") &&
    (r.actions || []).some((a) => a.id === "feedback_no"),
  "feedback actions present (yes/no)"
);

r = logResult("feedback_yes", DreamEngine.processAction(session, "feedback_yes"));
session = r.session;
assert(session.phase === "done", 'feedback_yes → phase "done"');
assert(!r.image, "no image after yes");
assert(
  /прекрасно|до встречи/i.test((r.replies || []).join(" ")),
  "yes reply is farewell"
);

// --- Path B: feedback_no → refine → addition → feedback ---
session = DreamEngine.createSession();
r = DreamEngine.processUserMessage(
  session,
  "Мне приснилось свадебное платье и мой муж рядом на церемонии"
);
session = r.session;
for (const c of clarifications) {
  r = DreamEngine.processUserMessage(session, c);
  session = r.session;
}
assert(session.phase === "feedback", "path B reached feedback");

r = logResult("feedback_no", DreamEngine.processAction(session, "feedback_no"));
session = r.session;
assert(session.phase === "refine", 'feedback_no → phase "refine"');

r = logResult(
  "refine_msg",
  DreamEngine.processUserMessage(
    session,
    "Ещё было белое платье и кольца на руках"
  )
);
session = r.session;
assert(session.phase === "feedback", "after refine message → feedback again");
assert(
  (r.actions || []).some((a) => a.id === "feedback_yes"),
  "feedback actions again after refine"
);

console.log("\n--- summary ---");
if (fails.length) {
  console.error("FAILED:", fails.length);
  fails.forEach((f) => console.error(" -", f));
  process.exit(1);
}
console.log("All checks passed.");
process.exit(0);
