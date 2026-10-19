import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code = fs.readFileSync(new URL("../dist/chrome/fork-extras.js", import.meta.url), "utf8");
const sandbox = { console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "fork-extras.js" });
const fork = sandbox.ImmersiveFork;
assert.ok(fork, "fork helpers are exported");

assert.equal(fork.normalizeShortcut("alt + shift + s"), "Alt+Shift+S");
assert.equal(fork.normalizeShortcut("ctrl+shift+Key"), "");
assert.equal(fork.isUsableShortcut("Shift+A"), false);
assert.equal(fork.isUsableShortcut("Alt+S"), true);
assert.equal(
  fork.eventToShortcut({ altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: "KeyS", key: "s" }),
  "Alt+Shift+S"
);

const catalog = fork.mergeServiceCatalog(
  {
    "bing-free": { type: "bing", group: "free" },
    custom: { type: "custom" },
    "my-ai": { type: "custom-ai" },
    "hidden.add_v.[1.0.0]": { type: "bing" },
  },
  { custom: { name: "My API", apiKey: "secret" } }
);
assert.equal(catalog.custom.name, "My API");
assert.equal(catalog.custom.type, "custom");
assert.equal(catalog["hidden.add_v.[1.0.0]"], undefined);

assert.equal(fork.toggleActiveService({}, catalog), null);
assert.equal(
  fork.toggleActiveService({ serviceSwitch: { shortcut: "Alt+S", serviceA: "bing-free" } }, catalog),
  null
);
assert.equal(
  fork.toggleActiveService({
    serviceSwitch: { shortcut: "Shift+A", serviceA: "bing-free", serviceB: "custom" },
  }, catalog),
  null
);

const original = {
  translationService: "deepl",
  userTranslationServices: { inputTranslationService: "google" },
  serviceSwitch: { shortcut: "Alt+S", serviceA: "bing-free", serviceB: "custom" },
  untouched: true,
};
const first = fork.toggleActiveService(original, catalog);
assert.equal(original.translationService, "deepl");
assert.equal(first.translationService, "custom");
assert.equal(first.userTranslationServices.translationService, "custom");
assert.equal(first.userTranslationServices.inputTranslationService, "google");
assert.equal(first.serviceSwitch.serviceB, "custom");
assert.equal(first.untouched, true);

const second = fork.toggleActiveService(first, catalog);
assert.equal(second.translationService, "bing");
assert.equal(second.userTranslationServices.translationService, "bing-free");

const back = fork.toggleActiveService(second, catalog);
assert.equal(back.userTranslationServices.translationService, "custom");

const ai = fork.applyActiveService({ serviceSwitch: { shortcut: "Alt+S" } }, catalog, "my-ai");
assert.equal(ai.translationService, "my-ai");
assert.equal(ai.userTranslationServices.translationService, "my-ai");

const neither = fork.toggleActiveService({
  translationService: "deepl",
  serviceSwitch: { shortcut: "Command+J", serviceA: "bing-free", serviceB: "custom" },
}, catalog);
assert.equal(neither.userTranslationServices.translationService, "custom");

console.log("service-switch tests passed");
