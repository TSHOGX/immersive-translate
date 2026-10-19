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
const altShiftS = { altKey: true, shiftKey: true, ctrlKey: false, metaKey: false, code: "KeyS", key: "s" };
const capturedAltShiftS = fork.captureFromEvent(altShiftS);
assert.equal(capturedAltShiftS.type, "complete");
assert.equal(capturedAltShiftS.value, "Alt+Shift+S");
assert.equal(fork.eventToShortcut(altShiftS), "Alt+Shift+S");
assert.equal(fork.eventMatchesShortcut(altShiftS, "alt + shift + s"), true);
assert.equal(fork.eventMatchesShortcut(altShiftS, ""), false);
const bareKey = fork.captureFromEvent({ code: "KeyS", key: "s" });
assert.equal(bareKey.type, "rejected");
assert.equal(bareKey.value, "S");
assert.equal(fork.eventToShortcut({ code: "KeyS", key: "s" }), "");
assert.equal(fork.captureFromEvent({ altKey: true, code: "AltLeft", key: "Alt" }).type, "modifier");
assert.equal(fork.captureFromEvent({ shiftKey: true, code: "KeyS", key: "S" }).type, "rejected");
assert.equal(fork.shortcutSetting({
  serviceSwitch: { shortcut: "", serviceA: "custom-ai-wX7esHRO", serviceB: "google-free" },
}), null);
assert.equal(fork.switchConfirmation("modelarts", "zh-CN"), "已切换到 modelarts");
assert.equal(fork.switchConfirmation("google-free", "en"), "Switched to google-free");
assert.equal(fork.switchConfirmation("", "zh-CN"), "");
assert.equal(fork.serviceDisplayName("custom-ai-wX7esHRO", {
  "custom-ai-wX7esHRO": { name: "modelarts", type: "custom-ai" },
}), "modelarts");

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

const savedSwitch = fork.applyServiceSwitch({
  shortcuts: { toggleTranslatePage: "Alt+A" },
  translationService: "bing",
}, {
  shortcut: "Alt+Shift+S",
  serviceA: "custom-ai-wX7esHRO",
  serviceB: "google-free",
});
assert.equal(savedSwitch.shortcuts.forkSwitchTranslationService, "Alt+Shift+S");
assert.equal(savedSwitch.shortcuts.toggleTranslatePage, "Alt+A");
assert.equal(savedSwitch.serviceSwitch.serviceB, "google-free");
assert.equal(fork.eventMatchesShortcut(altShiftS, savedSwitch.shortcuts.forkSwitchTranslationService), true);
const switched = fork.toggleActiveService(savedSwitch, {
  "custom-ai-wX7esHRO": { type: "custom-ai", name: "modelarts" },
  "google-free": { type: "google", group: "free" },
});
assert.equal(switched.userTranslationServices.translationService, "google-free");
assert.equal(switched.shortcuts.forkSwitchTranslationService, "Alt+Shift+S");
const cleared = fork.applyServiceSwitch(savedSwitch, { shortcut: "", serviceA: "custom-ai-wX7esHRO", serviceB: "google-free" });
assert.equal(Object.prototype.hasOwnProperty.call(cleared.shortcuts, "forkSwitchTranslationService"), false);
assert.equal(fork.toggleActiveService(cleared, catalog), null);

console.log("service-switch tests passed");

function createNode(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    children: [],
    parentElement: null,
    parentNode: null,
    style: {},
    className: "",
    id: "",
    value: "",
    placeholder: "",
    readOnly: false,
    disabled: false,
    autocomplete: "",
    spellcheck: false,
    type: "",
    title: "",
    textContent: "",
    innerHTML: "",
    listeners: {},
    attrs: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    appendChild(child) {
      child.parentElement = this;
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertBefore(node, before) {
      node.parentElement = this;
      node.parentNode = this;
      const index = this.children.indexOf(before);
      if (index < 0) this.children.push(node);
      else this.children.splice(index, 0, node);
      return node;
    },
    remove() {
      const parent = this.parentElement;
      if (!parent) return;
      parent.children = parent.children.filter((child) => child !== this);
      this.parentElement = null;
      this.parentNode = null;
    },
    addEventListener(type, fn) {
      this.listeners[type] = this.listeners[type] || [];
      this.listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn);
    },
    querySelector(selector) {
      return findNode(this, selector);
    },
    querySelectorAll() { return []; },
    closest(selector) {
      if (selector === "article" && this.tagName === "ARTICLE") return this;
      return this.parentElement ? this.parentElement.closest(selector) : null;
    },
    focus() {},
  };
}

function findNode(node, selector) {
  const className = selector.startsWith(".") ? selector.slice(1) : "";
  if (className && String(node.className || "").split(/\s+/).includes(className)) return node;
  for (const child of node.children || []) {
    const found = findNode(child, selector);
    if (found) return found;
  }
  return null;
}

const ui = {};
ui.document = {
  documentElement: createNode("html"),
  head: createNode("head"),
  body: createNode("body"),
  createElement: createNode,
  getElementById(id) {
    return findById(ui.document.documentElement, id) || findById(ui.document.head, id) || findById(ui.document.body, id);
  },
  querySelector(selector) {
    if (String(selector).includes("immersive-translate-options")) return { name: "meta" };
    if (selector === ".shortcut-group-header") return ui.header;
    return null;
  },
  querySelectorAll() { return []; },
  addEventListener() {},
};
function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}
ui.header = createNode("div");
ui.header.className = "shortcut-group-header";
ui.article = createNode("article");
ui.parent = createNode("div");
ui.parent.appendChild(ui.article);
ui.article.appendChild(ui.header);
ui.stored = {};
const uiSandbox = {
  console,
  document: ui.document,
  location: { protocol: "chrome-extension:", pathname: "/options.html", hash: "#shortcuts" },
  MutationObserver: class { constructor() {} observe() {} disconnect() {} },
  requestAnimationFrame(fn) { fn(); },
  fetch() {
    return Promise.resolve({
      json: () => Promise.resolve({
        translationServices: {
          "google-free": { type: "google", group: "free" },
          "custom-ai-wX7esHRO": { type: "custom-ai", name: "modelarts" },
        },
      }),
    });
  },
  chrome: {
    storage: {
      local: {
        get() { return Promise.resolve({ fullLocalUserConfig: ui.stored }); },
        set(items) { ui.stored = items.fullLocalUserConfig; return Promise.resolve(); },
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      getURL() { return "default_config.json"; },
      sendMessage() { return Promise.resolve(true); },
    },
  },
};
uiSandbox.listeners = {};
uiSandbox.addEventListener = function (type, fn) {
  this.listeners[type] = this.listeners[type] || [];
  this.listeners[type].push(fn);
};
uiSandbox.removeEventListener = function (type, fn) {
  this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn);
};
uiSandbox.window = uiSandbox;
uiSandbox.globalThis = uiSandbox;
uiSandbox.document.documentElement.lang = "zh-CN";
vm.createContext(uiSandbox);
vm.runInContext(code, uiSandbox, { filename: "fork-extras.js" });

const input = findNode(ui.parent, ".shortcut-recorder__input");
assert.ok(input, "shortcut field is on the shortcuts page");
assert.equal(input.value, "");
assert.ok(findNode(ui.parent, ".shortcut-recorder"), "uses the same recorder shell as the other shortcuts");
for (const fn of input.listeners.click || []) fn({ preventDefault() {} });
for (const fn of uiSandbox.listeners.keydown || []) {
  fn({
    type: "keydown",
    key: "s",
    code: "KeyS",
    altKey: true,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
    stopPropagation() {},
  });
}
assert.equal(input.value, "Alt+Shift+S");
for (let i = 0; i < 8; i += 1) await Promise.resolve();
assert.equal(ui.stored.serviceSwitch.shortcut, "Alt+Shift+S");
assert.equal(ui.stored.shortcuts.forkSwitchTranslationService, "Alt+Shift+S");
assert.equal(ui.stored.serviceSwitch.serviceA || "", "");
assert.equal(fork.eventMatchesShortcut(altShiftS, ui.stored.serviceSwitch.shortcut), true);
const statusText = JSON.stringify(ui.parent, (key, value) => key === "parentElement" || key === "parentNode" || key === "listeners" ? undefined : value);
assert.equal(statusText.includes("已启用"), false);

console.log("shortcut recorder capture passed");

const manifest = JSON.parse(fs.readFileSync(new URL("../dist/chrome/manifest.json", import.meta.url), "utf8"));
const listed = manifest.content_scripts.flatMap((entry) => entry.js || []);
const loaded = new Set(listed);
for (const file of listed) {
  const text = fs.readFileSync(new URL("../dist/chrome/" + file, import.meta.url), "utf8");
  for (const match of text.matchAll(/["']([^"']+\.js)["']/g)) {
    if (match[1].includes("..")) continue;
    loaded.add(match[1].split("/").pop());
  }
}
assert.ok(loaded.has("content_main.js"), "content guard loads content_main.js");
const dispatcherText = fs.readFileSync(new URL("../dist/chrome/content_main.js", import.meta.url), "utf8");
assert.match(dispatcherText, /SSe\(\{changeToEngine:/);
assert.match(dispatcherText, /loginSuccessUpdateUser:/);
assert.match(dispatcherText, /onlyUpdateUser:/);
assert.match(dispatcherText, /changeToSuccessFreeEngine:/);
assert.match(dispatcherText, /if\(!sz\.changeToEngine/);
const shortcutHandler = dispatcherText.slice(dispatcherText.indexOf("async function vFS()"), dispatcherText.indexOf("function _$e("));
assert.match(shortcutHandler, /za\("changeToEngine"\)/);
assert.match(shortcutHandler, /toggleActiveService/);
assert.match(shortcutHandler, /context invalidated/);
assert.equal(shortcutHandler.includes("mn("), false);
const dispatchFn = dispatcherText.slice(dispatcherText.indexOf("function _$e("), dispatcherText.indexOf("function R$e("));
assert.match(dispatchFn, /command==="forkSwitchTranslationService"\)return vFS\(\)/);

console.log("manifest dispatcher wiring passed");
