/* Immersive Translate fork extras.
   Optional service-switch shortcut, plus removal of client subscription surfaces.
   Services that only work because immersivetranslate.com checks a subscription
   still depend on that server; this file does not impersonate a paid account. */
(function (root) {
  "use strict";

  var USER_CONFIG_KEY = "fullLocalUserConfig";
  var MODIFIER_ORDER = ["Ctrl", "Command", "Alt", "Shift"];
  var MODIFIER_ALIAS = {
    ctrl: "Ctrl",
    control: "Ctrl",
    macctrl: "Ctrl",
    cmd: "Command",
    command: "Command",
    meta: "Command",
    alt: "Alt",
    option: "Alt",
    shift: "Shift",
  };

  function normalizeShortcut(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    var parts = raw
      .replace(/MacCtrl/gi, "Ctrl")
      .replace(/⌥/g, "Alt+")
      .replace(/⌘/g, "Command+")
      .replace(/⌃/g, "Ctrl+")
      .replace(/⇧/g, "Shift+")
      .replace(/\s*\+\s*/g, "+")
      .replace(/\+{2,}/g, "+")
      .replace(/^\+|\+$/g, "")
      .split("+")
      .filter(Boolean);
    var modifiers = [];
    var key = "";
    for (var i = 0; i < parts.length; i += 1) {
      var token = parts[i];
      var alias = MODIFIER_ALIAS[token.toLowerCase()];
      if (alias) {
        if (modifiers.indexOf(alias) === -1) modifiers.push(alias);
        continue;
      }
      if (/^f([1-9]|1[0-2])$/i.test(token)) key = token.toUpperCase();
      else if (token.toLowerCase() === "space") key = "Space";
      else if (token.length === 1) key = token.toUpperCase();
      else return "";
    }
    if (!key) return "";
    modifiers.sort(function (a, b) {
      return MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b);
    });
    return modifiers.concat(key).join("+");
  }

  function isUsableShortcut(value) {
    var shortcut = normalizeShortcut(value);
    return (
      shortcut.indexOf("Ctrl+") === 0 ||
      shortcut.indexOf("Command+") === 0 ||
      shortcut.indexOf("Alt+") === 0
    );
  }

  var CODE_KEYS = {
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backquote: "`",
    Space: "Space",
  };

  function keyFromEvent(event) {
    var code = event.code || "";
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^F(?:[1-9]|1[0-2])$/.test(code)) return code;
    if (CODE_KEYS[code]) return CODE_KEYS[code];
    if (event.key && event.key.length === 1 && event.key !== " ") return event.key.toUpperCase();
    return "";
  }

  function captureFromEvent(event) {
    if (!event || event.repeat || event.isComposing || event.key === "AltGraph") {
      return { type: "unsupported", value: "" };
    }
    var modifiers = [];
    if (event.ctrlKey) modifiers.push("Ctrl");
    if (event.metaKey) modifiers.push("Command");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    var key = keyFromEvent(event);
    if (!key || MODIFIER_ORDER.indexOf(key) !== -1) {
      return { type: "modifier", value: modifiers.join("+") };
    }
    var value = normalizeShortcut(modifiers.concat(key).join("+"));
    if (!isUsableShortcut(value)) return { type: "rejected", value: value };
    return { type: "complete", value: value };
  }

  function eventToShortcut(event) {
    var captured = captureFromEvent(event);
    return captured.type === "complete" ? captured.value : "";
  }

  function eventMatchesShortcut(event, shortcut) {
    var expected = normalizeShortcut(shortcut);
    if (!isUsableShortcut(expected)) return false;
    return eventToShortcut(event) === expected;
  }

  function switchConfirmation(name, lang) {
    var label = String(name || "").trim();
    if (!label) return "";
    return String(lang || "").toLowerCase().indexOf("zh") === 0
      ? "已切换到 " + label
      : "Switched to " + label;
  }

  function serviceDisplayName(id, catalog) {
    var service = catalog && catalog[id];
    if (service && typeof service.name === "string" && service.name && service.name !== id) return service.name;
    return String(id || "");
  }

  function shortcutSetting(config) {
    var setting = config && config.serviceSwitch;
    if (!setting || typeof setting !== "object") return null;
    var shortcut = normalizeShortcut(setting.shortcut || "");
    var serviceA = String(setting.serviceA || "").trim();
    var serviceB = String(setting.serviceB || "").trim();
    if (!isUsableShortcut(shortcut) || !serviceA || !serviceB || serviceA === serviceB) return null;
    return { shortcut: shortcut, serviceA: serviceA, serviceB: serviceB };
  }

  function activeServiceId(config) {
    var mapped = config && config.userTranslationServices && config.userTranslationServices.translationService;
    if (typeof mapped === "string" && mapped) return mapped;
    return config && typeof config.translationService === "string" ? config.translationService : "";
  }

  function mergeServiceCatalog(base, extra) {
    var out = {};
    var source = base && typeof base === "object" ? base : {};
    Object.keys(source).forEach(function (id) {
      if (id.indexOf(".add_v.") !== -1) return;
      var value = source[id];
      if (value && typeof value === "object") out[id] = value;
    });
    var user = extra && typeof extra === "object" ? extra : {};
    Object.keys(user).forEach(function (id) {
      if (id.indexOf(".add_v.") !== -1) return;
      var value = user[id];
      if (value && typeof value === "object") out[id] = Object.assign({}, out[id] || {}, value);
    });
    return out;
  }

  function applyActiveService(config, catalog, serviceId) {
    var current = config && typeof config === "object" ? config : {};
    var service = catalog && catalog[serviceId];
    var next = Object.assign({}, current, {
      translationServiceChangedbyUserAt: new Date().toISOString(),
    });
    if (service && service.type === "custom-ai") next.translationService = serviceId;
    else if (service && typeof service.type === "string" && service.type) next.translationService = service.type;
    else next.translationService = serviceId;
    next.userTranslationServices = Object.assign({}, current.userTranslationServices || {}, {
      translationService: serviceId,
    });
    return next;
  }

  function toggleActiveService(config, catalog) {
    var setting = shortcutSetting(config);
    if (!setting) return null;
    var current = activeServiceId(config);
    var target = current === setting.serviceB ? setting.serviceA : setting.serviceB;
    return applyActiveService(config, catalog, target);
  }

  var SWITCH_COMMAND = "forkSwitchTranslationService";

  function applyServiceSwitch(config, serviceSwitch) {
    var current = config && typeof config === "object" ? config : {};
    var shortcut = serviceSwitch && serviceSwitch.shortcut ? normalizeShortcut(serviceSwitch.shortcut) : "";
    if (!isUsableShortcut(shortcut)) shortcut = "";
    var stored = {
      shortcut: shortcut,
      serviceA: String((serviceSwitch && serviceSwitch.serviceA) || "").trim(),
      serviceB: String((serviceSwitch && serviceSwitch.serviceB) || "").trim(),
    };
    var shortcuts = Object.assign({}, current.shortcuts || {});
    if (shortcut) shortcuts[SWITCH_COMMAND] = shortcut;
    else delete shortcuts[SWITCH_COMMAND];
    return Object.assign({}, current, { serviceSwitch: stored, shortcuts: shortcuts });
  }

  var api = {
    USER_CONFIG_KEY: USER_CONFIG_KEY,
    normalizeShortcut: normalizeShortcut,
    isUsableShortcut: isUsableShortcut,
    captureFromEvent: captureFromEvent,
    eventToShortcut: eventToShortcut,
    eventMatchesShortcut: eventMatchesShortcut,
    switchConfirmation: switchConfirmation,
    serviceDisplayName: serviceDisplayName,
    shortcutSetting: shortcutSetting,
    activeServiceId: activeServiceId,
    mergeServiceCatalog: mergeServiceCatalog,
    applyActiveService: applyActiveService,
    toggleActiveService: toggleActiveService,
    applyServiceSwitch: applyServiceSwitch,
    SWITCH_COMMAND: SWITCH_COMMAND,
  };
  root.ImmersiveFork = api;

  if (typeof document === "undefined") return;

  var CONTENT_SELECTORS = [
    ".membership-prompt-drawer",
    ".drawer-body-membership-prompt",
    ".screenshot-area-membership-prompt-backdrop",
    ".screenshot-area-membership-prompt-card",
    ".custom-select-item-membership-badge",
    "[data-popup-membership-prompt]",
  ];
  var EXTENSION_SELECTORS = CONTENT_SELECTORS.concat([
    ".upgrade-pro",
    ".upgrade-pro-discount-act",
    ".upgrade-tips",
    "a[href*='pricing']",
    "a[href*='/subscribe']",
    "a[href*='checkout']",
    "a[href*='membership']",
  ]);

  function extensionRuntime() {
    return root.chrome || root.browser || null;
  }

  function storageArea() {
    try {
      var runtime = extensionRuntime();
      return (runtime && runtime.storage && runtime.storage.local) || null;
    } catch (error) {
      return null;
    }
  }

  function isExtensionDocument() {
    var protocol = location.protocol;
    return protocol === "chrome-extension:" || protocol === "moz-extension:";
  }

  function isOptionsDocument() {
    return !!document.querySelector('meta[name="immersive-translate-options"]') ||
      /options\.html$/i.test(location.pathname);
  }

  function inTopFrame() {
    try {
      return window.top === window;
    } catch (error) {
      return false;
    }
  }

  function showSwitchConfirmation(name) {
    var lang = (document.documentElement && document.documentElement.lang) || "";
    var message = switchConfirmation(name, lang);
    if (!message || !document.documentElement) return;
    var previous = document.getElementById("imt-fork-switch-toast");
    if (previous) previous.remove();
    var toast = document.createElement("div");
    toast.id = "imt-fork-switch-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    toast.style.cssText = [
      "all:initial",
      "position:fixed",
      "top:20px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "pointer-events:none",
      "box-sizing:border-box",
      "background:#1f2328",
      "color:#ffffff",
      "font:600 14px/1.4 system-ui,-apple-system,sans-serif",
      "padding:10px 14px",
      "border-radius:8px",
      "box-shadow:0 8px 24px rgba(0,0,0,.22)",
    ].join(";");
    document.documentElement.appendChild(toast);
    root.setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 2200);
  }

  function announceSwitch(name, lang, options) {
    var resolved = lang || (document.documentElement && document.documentElement.lang) || "";
    var message = switchConfirmation(name, resolved);
    if (!message) return;
    if (options && options.invalidated) {
      message += String(resolved).toLowerCase().indexOf("zh") === 0
        ? "。请刷新页面一次，才会保存。"
        : ". Refresh the page once to save it.";
    }
    var previous = document.getElementById("imt-fork-switch-toast");
    if (previous) previous.remove();
    var toast = document.createElement("div");
    toast.id = "imt-fork-switch-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    toast.style.cssText = [
      "all:initial",
      "position:fixed",
      "top:20px",
      "left:50%",
      "transform:translateX(-50%)",
      "z-index:2147483647",
      "pointer-events:none",
      "box-sizing:border-box",
      "background:#1f2328",
      "color:#ffffff",
      "font:600 14px/1.4 system-ui,-apple-system,sans-serif",
      "padding:10px 14px",
      "border-radius:8px",
      "box-shadow:0 8px 24px rgba(0,0,0,.22)",
    ].join(";");
    document.documentElement.appendChild(toast);
    root.setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 2200);
  }
  root.ImmersiveFork.announceSwitch = announceSwitch;

  function uiText() {
    var lang = (document.documentElement && document.documentElement.lang) || "";
    if (lang.toLowerCase().indexOf("zh") === 0) {
      return {
        title: "切换翻译服务",
        hint: "可选。快捷键和下面两个服务都设置后，才会在它们之间切换。留空时保持原来的行为。",
        shortcut: "快捷键",
        record: "点击后按下组合键",
        capturing: "请按下快捷键",
        clear: "清除",
        serviceA: "服务 A",
        serviceB: "服务 B",
        unset: "不设置",
        saved: "已保存",
        invalid: "请使用带 Ctrl、Alt 或 Command 的组合键",
        same: "请选择两个不同的服务",
        ready: "已启用",
        idle: "未启用",
        failed: "保存失败",
      };
    }
    return {
      title: "Switch translation service",
      hint: "Optional. The shortcut switches services only after it and both services are set. Leave them empty to keep the current behavior.",
      shortcut: "Shortcut",
      record: "Click, then press a shortcut",
      capturing: "Press a shortcut",
      clear: "Clear",
      serviceA: "Service A",
      serviceB: "Service B",
      unset: "Not set",
      saved: "Saved",
      invalid: "Use a shortcut with Ctrl, Alt, or Command",
      same: "Choose two different services",
      ready: "Enabled",
      idle: "Off",
      failed: "Could not save",
    };
  }

  function callStorage(method, args) {
    var storage = storageArea();
    if (!storage || typeof storage[method] !== "function") return Promise.resolve(null);
    var fn = storage[method];
    try {
      var result = fn.apply(storage, args);
      if (result && typeof result.then === "function") return result;
    } catch (error) {
      return Promise.reject(error);
    }
    return new Promise(function (resolve, reject) {
      try {
        fn.apply(storage, args.concat([function (value) {
          var runtime = extensionRuntime();
          if (runtime && runtime.runtime && runtime.runtime.lastError) reject(runtime.runtime.lastError);
          else resolve(value);
        }]));
      } catch (error) {
        reject(error);
      }
    });
  }

  function readUserConfig() {
    return callStorage("get", [USER_CONFIG_KEY]).then(function (result) {
      var config = result && result[USER_CONFIG_KEY];
      return config && typeof config === "object" ? config : {};
    }, function () {
      return {};
    });
  }

  function writeUserConfig(config) {
    var items = {};
    items[USER_CONFIG_KEY] = config;
    return callStorage("set", [items]);
  }

  function installStoragePreserve() {
    var storage = storageArea();
    if (!storage || storage.__imtForkPatched) return;
    var originalGet = storage.get.bind(storage);
    var originalSet = storage.set.bind(storage);
    storage.get = function (keys, callback) {
      var actualKeys = keys;
      var actualCallback = callback;
      if (typeof keys === "function") {
        actualCallback = keys;
        actualKeys = undefined;
      }
      var capture = function (result) {
        if (!root.__imtForkHeldLock) {
          var config = result && result[USER_CONFIG_KEY];
          if (config && config.serviceSwitch && typeof config.serviceSwitch === "object") {
            root.__imtForkHeldServiceSwitch = config.serviceSwitch;
          }
        }
        return result;
      };
      if (typeof actualCallback === "function") {
        var getArgs = actualKeys === undefined ? [] : [actualKeys];
        return originalGet.apply(storage, getArgs.concat([function (result) {
          try { capture(result); } catch (error) {}
          actualCallback(result);
        }]));
      }
      var pending = actualKeys === undefined ? originalGet() : originalGet(actualKeys);
      return Promise.resolve(pending).then(capture);
    };
    storage.set = function (items, callback) {
      var held = root.__imtForkHeldServiceSwitch;
      if (held && items && Object.prototype.hasOwnProperty.call(items, USER_CONFIG_KEY)) {
        var config = items[USER_CONFIG_KEY];
        if (config && typeof config === "object") {
          var next = {};
          next[USER_CONFIG_KEY] = applyServiceSwitch(config, held);
          items = Object.assign({}, items, next);
        }
      }
      return originalSet(items, callback);
    };
    storage.__imtForkPatched = true;
  }

  function subscriptionHref(href) {
    var value = String(href || "");
    if (!value || value.indexOf("javascript:") === 0) return false;
    return /(?:^|[/?#])(pricing|checkout|subscribe|membership|billing)(?:[/?#]|$)/i.test(value);
  }

  function removeSubscriptionNodes(extensionPage) {
    var selectors = extensionPage ? EXTENSION_SELECTORS : CONTENT_SELECTORS;
    document.querySelectorAll(selectors.join(",")).forEach(function (node) {
      if (node && node.isConnected) node.remove();
    });
  }

  function installSubscriptionRemoval() {
    var extensionPage = isExtensionDocument();
    var style = document.createElement("style");
    style.setAttribute("data-imt-fork", "subscription");
    style.textContent = (extensionPage ? EXTENSION_SELECTORS : CONTENT_SELECTORS).join(",") +
      "{display:none !important;}";
    (document.head || document.documentElement).appendChild(style);
    var sweep = function () { removeSubscriptionNodes(extensionPage); };
    sweep();
    var observer = new MutationObserver(sweep);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (extensionPage) {
      document.addEventListener("click", function (event) {
        var target = event.target && event.target.closest
          ? event.target.closest("a,button")
          : null;
        if (!target) return;
        var href = target.getAttribute("href") || "";
        if (subscriptionHref(href) || target.closest(EXTENSION_SELECTORS.join(","))) {
          event.preventDefault();
          event.stopPropagation();
        }
      }, true);
      if (typeof root.open === "function" && !root.open.__imtFork) {
        var originalOpen = root.open.bind(root);
        var wrapped = function (url) {
          if (subscriptionHref(url)) return null;
          return originalOpen.apply(root, arguments);
        };
        wrapped.__imtFork = true;
        root.open = wrapped;
      }
    }
  }

  var catalogPromise = null;
  function loadCatalog(userConfig) {
    if (!catalogPromise) {
      var runtime = extensionRuntime();
      var url = runtime && runtime.runtime && runtime.runtime.getURL
        ? runtime.runtime.getURL("default_config.json")
        : "";
      catalogPromise = url
        ? fetch(url).then(function (response) { return response.json(); }).then(function (json) {
          return (json && json.translationServices) || {};
        }).catch(function () { return {}; })
        : Promise.resolve({});
    }
    return catalogPromise.then(function (base) {
      return mergeServiceCatalog(base, userConfig && userConfig.translationServices);
    });
  }

  function serviceChoices(catalog, selected) {
    var entries = Object.keys(catalog).map(function (id) { return [id, catalog[id]]; });
    entries.sort(function (a, b) {
      var rank = function (service) {
        var group = (service && service.group) || "";
        var type = (service && service.type) || "";
        if (group === "free" || group === "custom" || type === "custom" || type === "custom-ai") return 0;
        if (group === "pro") return 2;
        if (group === "max") return 3;
        return 1;
      };
      return rank(a[1]) - rank(b[1]) || a[0].localeCompare(b[0]);
    });
    if (selected && !catalog[selected]) entries.unshift([selected, { name: selected }]);
    return entries;
  }

  function serviceLabel(id, service) {
    var name = service && typeof service.name === "string" ? service.name : "";
    var group = (service && (service.group || service.type)) || "";
    if (name && name !== id) return name + " (" + id + ")";
    return group ? id + " · " + group : id;
  }

  function sendSwitch(userConfig) {
    var runtime = extensionRuntime();
    var messenger = runtime && runtime.runtime;
    if (!messenger || typeof messenger.sendMessage !== "function") return Promise.resolve(false);
    var message = {
      to: "background:main",
      from: "content:fork",
      payload: {
        method: "forkSwitchTranslationService",
        data: { userConfig: userConfig },
      },
    };
    try {
      var result = messenger.sendMessage(message);
      if (result && typeof result.then === "function") {
        return result.then(function () { return true; }, function () { return false; });
      }
    } catch (error) {
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      try {
        messenger.sendMessage(message, function () {
          resolve(!(messenger.lastError));
        });
      } catch (error) {
        resolve(false);
      }
    });
  }

  function migrateSwitchCommand() {
    readUserConfig().then(function (config) {
      var setting = config && config.serviceSwitch;
      if (!setting || !setting.shortcut) return;
      var normalized = normalizeShortcut(setting.shortcut);
      if (!isUsableShortcut(normalized)) return;
      var current = config.shortcuts && config.shortcuts[SWITCH_COMMAND];
      if (current === normalized) return;
      return writeUserConfig(applyServiceSwitch(config, setting));
    }).catch(function () {});
  }

  function deliverSwitch(userConfig) {
    sendSwitch(userConfig).then(function (ok) {
      if (!ok) writeUserConfig(userConfig);
    });
    root.setTimeout(function () { sendSwitch(userConfig); }, 600);
  }

  function fillSelect(select, catalog, selected, unsetLabel) {
    var current = select.value;
    select.textContent = "";
    var empty = document.createElement("option");
    empty.value = "";
    empty.textContent = unsetLabel;
    select.appendChild(empty);
    serviceChoices(catalog, selected).forEach(function (entry) {
      var option = document.createElement("option");
      option.value = entry[0];
      option.textContent = serviceLabel(entry[0], entry[1]);
      select.appendChild(option);
    });
    select.value = selected || current || "";
    if (select.value !== (selected || "")) select.value = selected || "";
  }

  function installShortcutSettings() {
    if (document.getElementById("imt-fork-service-switch-style")) return;
    var style = document.createElement("style");
    style.id = "imt-fork-service-switch-style";
    style.textContent = [
      "#imt-fork-service-switch{border:1px solid var(--muted-border-color,#d0d7de);border-radius:8px;padding:12px 16px;margin:0 0 16px;}",
      "#imt-fork-service-switch h2{font-size:1.05rem;margin:0 0 6px;}",
      "#imt-fork-service-switch p{margin:0 0 8px;color:var(--muted-color,#57606a);font-size:.9rem;}",
      "#imt-fork-service-switch .imt-fork-row{display:flex;gap:12px;align-items:center;margin:8px 0;}",
      "#imt-fork-service-switch .imt-fork-row > span{min-width:7em;}",
      "#imt-fork-service-switch select{flex:1;margin:0;}",
      "#imt-fork-service-switch .shortcut-recorder{flex:1;width:auto;max-width:none;}",
      "#imt-fork-service-switch .imt-fork-status{min-height:1.2em;}",
    ].join("");
    (document.head || document.documentElement).appendChild(style);

    var panel = null;
    var shortcutInput = null;
    var serviceA = null;
    var serviceB = null;
    var status = null;
    var readyNote = null;
    var catalog = {};
    var mountedConfig = null;
    var committedShortcut = "";
    var capturing = false;
    var captureListener = null;

    function refreshNote() {
      if (!readyNote) return;
      var text = uiText();
      var setting = shortcutSetting({
        serviceSwitch: {
          shortcut: committedShortcut,
          serviceA: serviceA.value,
          serviceB: serviceB.value,
        },
      });
      readyNote.textContent = setting ? text.ready : text.idle;
      var clearButton = panel && panel.querySelector(".shortcut-recorder__clear");
      if (clearButton) clearButton.disabled = !committedShortcut;
    }

    function save(partial, message) {
      var text = uiText();
      root.__imtForkHeldLock = true;
      return readUserConfig().then(function (config) {
        var serviceSwitch = Object.assign(
          { shortcut: "", serviceA: "", serviceB: "" },
          config.serviceSwitch || {},
          partial
        );
        if (serviceSwitch.shortcut) {
          serviceSwitch.shortcut = normalizeShortcut(serviceSwitch.shortcut);
          if (!isUsableShortcut(serviceSwitch.shortcut)) serviceSwitch.shortcut = "";
        }
        committedShortcut = serviceSwitch.shortcut || "";
        if (shortcutInput && !capturing) shortcutInput.value = committedShortcut;
        root.__imtForkHeldServiceSwitch = serviceSwitch;
        var next = applyServiceSwitch(config, serviceSwitch);
        mountedConfig = next;
        return writeUserConfig(next).then(function () {
          status.textContent = message || text.saved;
          refreshNote();
        });
      }).catch(function () {
        status.textContent = text.failed;
      }).then(function () {
        root.__imtForkHeldLock = false;
      });
    }

    function buildPanel() {
      var text = uiText();
      panel = document.createElement("article");
      panel.id = "imt-fork-service-switch";
      panel.className = "mb-8";
      var title = document.createElement("h2");
      title.textContent = text.title;
      var hint = document.createElement("p");
      hint.textContent = text.hint;
      readyNote = document.createElement("p");
      readyNote.className = "imt-fork-status";
      var recorder = document.createElement("div");
      recorder.className = "shortcut-recorder";
      shortcutInput = document.createElement("input");
      shortcutInput.type = "text";
      shortcutInput.className = "shortcut-recorder__input";
      shortcutInput.readOnly = true;
      shortcutInput.autocomplete = "off";
      shortcutInput.spellcheck = false;
      shortcutInput.placeholder = text.record;
      shortcutInput.setAttribute("aria-label", text.shortcut);
      var clear = document.createElement("button");
      clear.type = "button";
      clear.className = "shortcut-recorder__clear";
      clear.title = text.clear;
      clear.setAttribute("aria-label", text.clear);
      clear.innerHTML = "<svg viewBox='0 0 16 16' aria-hidden='true'><path fill='currentColor' d='M4.2 3.5 8 7.3l3.8-3.8 1.2 1.2L9.2 8.5l3.8 3.8-1.2 1.2L8 9.7l-3.8 3.8-1.2-1.2 3.8-3.8-3.8-3.8z'/></svg>";
      recorder.appendChild(shortcutInput);
      recorder.appendChild(clear);
      serviceA = document.createElement("select");
      serviceA.setAttribute("aria-label", text.serviceA);
      serviceB = document.createElement("select");
      serviceB.setAttribute("aria-label", text.serviceB);
      status = document.createElement("p");
      status.className = "imt-fork-status";
      status.setAttribute("role", "status");

      function row(labelText, control) {
        var wrap = document.createElement("div");
        wrap.className = "imt-fork-row";
        var label = document.createElement("span");
        label.textContent = labelText;
        wrap.appendChild(label);
        wrap.appendChild(control);
        return wrap;
      }

      function stopCapture(restore) {
        capturing = false;
        if (captureListener) {
          window.removeEventListener("keydown", captureListener, true);
          window.removeEventListener("keyup", captureListener, true);
          captureListener = null;
        }
        shortcutInput.placeholder = uiText().record;
        if (restore) shortcutInput.value = committedShortcut;
      }

      function onCaptureKey(event) {
        if (!capturing) return;
        if (event.type === "keyup") {
          if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && !isUsableShortcut(shortcutInput.value)) {
            shortcutInput.value = committedShortcut;
          }
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") {
          stopCapture(true);
          return;
        }
        if (event.key === "Backspace" || event.key === "Delete") {
          stopCapture(false);
          shortcutInput.value = "";
          save({ shortcut: "" }, uiText().saved);
          return;
        }
        var captured = captureFromEvent(event);
        if (captured.type === "unsupported") return;
        if (captured.type === "modifier") {
          shortcutInput.value = captured.value;
          return;
        }
        if (captured.type !== "complete") {
          status.textContent = uiText().invalid;
          shortcutInput.value = committedShortcut;
          return;
        }
        stopCapture(false);
        shortcutInput.value = captured.value;
        save({ shortcut: captured.value }, uiText().saved);
      }

      var captureStartedAt = 0;
      function startCapture(event) {
        if (event) event.preventDefault();
        captureStartedAt = Date.now();
        shortcutInput.focus();
        capturing = true;
        shortcutInput.placeholder = uiText().capturing;
        shortcutInput.value = "";
        if (!captureListener) {
          captureListener = onCaptureKey;
          window.addEventListener("keydown", captureListener, true);
          window.addEventListener("keyup", captureListener, true);
        }
      }

      clear.addEventListener("mousedown", function (event) { event.preventDefault(); });
      clear.addEventListener("click", function () {
        stopCapture(false);
        shortcutInput.value = "";
        save({ shortcut: "" }, text.saved);
      });
      shortcutInput.addEventListener("click", startCapture);
      shortcutInput.addEventListener("keydown", function (event) {
        if (!capturing && (event.key === "Enter" || event.key === " ")) startCapture(event);
      });
      shortcutInput.addEventListener("blur", function () {
        if (Date.now() - captureStartedAt < 400) {
          shortcutInput.focus();
          return;
        }
        stopCapture(true);
      });
      serviceA.addEventListener("change", function () {
        if (serviceA.value && serviceA.value === serviceB.value) {
          status.textContent = text.same;
          serviceA.value = "";
        }
        save({ serviceA: serviceA.value }, text.saved);
      });
      serviceB.addEventListener("change", function () {
        if (serviceB.value && serviceB.value === serviceA.value) {
          status.textContent = text.same;
          serviceB.value = "";
        }
        save({ serviceB: serviceB.value }, text.saved);
      });

      panel.appendChild(title);
      panel.appendChild(hint);
      panel.appendChild(readyNote);
      panel.appendChild(row(text.shortcut, recorder));
      panel.appendChild(row(text.serviceA, serviceA));
      panel.appendChild(row(text.serviceB, serviceB));
      panel.appendChild(status);
      refreshNote();
      return panel;
    }

    function applyConfig(config) {
      var setting = (config && config.serviceSwitch) || {};
      var stored = normalizeShortcut(setting.shortcut || "");
      committedShortcut = isUsableShortcut(stored) ? stored : "";
      if (!capturing) shortcutInput.value = committedShortcut;
      fillSelect(serviceA, catalog, setting.serviceA || "", uiText().unset);
      fillSelect(serviceB, catalog, setting.serviceB || "", uiText().unset);
      refreshNote();
    }

    function mount() {
      if (!location.hash || location.hash.indexOf("#shortcuts") !== 0) {
        if (panel && panel.parentElement) panel.remove();
        return;
      }
      var header = document.querySelector(".shortcut-group-header");
      if (!header) return;
      var article = header.closest("article");
      if (!article || !article.parentElement) return;
      if (!panel) buildPanel();
      if (panel.nextElementSibling === article && panel.parentElement === article.parentElement) return;
      article.parentElement.insertBefore(panel, article);
      if (!mountedConfig) {
        readUserConfig().then(function (config) {
          mountedConfig = config;
          return loadCatalog(config);
        }).then(function (loaded) {
          catalog = loaded || {};
          applyConfig(mountedConfig);
        }).catch(function () {});
      }
    }

    var scheduled = false;
    function scheduleMount() {
      if (scheduled) return;
      scheduled = true;
      root.requestAnimationFrame(function () {
        scheduled = false;
        mount();
      });
    }
    window.addEventListener("hashchange", scheduleMount);
    var observer = new MutationObserver(scheduleMount);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    scheduleMount();
  }

  try {
    if (isExtensionDocument()) {
      installStoragePreserve();
      installSubscriptionRemoval();
      if (isOptionsDocument()) installShortcutSettings();
      migrateSwitchCommand();
    } else {
      installSubscriptionRemoval();
      migrateSwitchCommand();
    }
  } catch (error) {}
})(typeof globalThis !== "undefined" ? globalThis : this);
