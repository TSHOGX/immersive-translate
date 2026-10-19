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
      if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(token)) key = token.toUpperCase();
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

  function eventToShortcut(event) {
    if (!event) return "";
    var modifiers = [];
    if (event.ctrlKey) modifiers.push("Ctrl");
    if (event.metaKey) modifiers.push("Command");
    if (event.altKey) modifiers.push("Alt");
    if (event.shiftKey) modifiers.push("Shift");
    var key = "";
    var code = event.code || "";
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
    else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
    else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
    else if (event.key && event.key.length === 1) key = event.key.toUpperCase();
    if (!key || MODIFIER_ORDER.indexOf(key) !== -1) return "";
    return modifiers.concat(key).join("+");
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

  var api = {
    USER_CONFIG_KEY: USER_CONFIG_KEY,
    normalizeShortcut: normalizeShortcut,
    isUsableShortcut: isUsableShortcut,
    eventToShortcut: eventToShortcut,
    shortcutSetting: shortcutSetting,
    activeServiceId: activeServiceId,
    mergeServiceCatalog: mergeServiceCatalog,
    applyActiveService: applyActiveService,
    toggleActiveService: toggleActiveService,
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
    var runtime = extensionRuntime();
    return (runtime && runtime.storage && runtime.storage.local) || null;
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

  function uiText() {
    var lang = (document.documentElement && document.documentElement.lang) || "";
    if (lang.toLowerCase().indexOf("zh") === 0) {
      return {
        title: "切换翻译服务",
        hint: "可选。快捷键和下面两个服务都设置后，才会在它们之间切换。留空时保持原来的行为。",
        shortcut: "快捷键",
        record: "点击后按下组合键",
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
          next[USER_CONFIG_KEY] = Object.assign({}, config, { serviceSwitch: held });
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

  function deliverSwitch(userConfig) {
    sendSwitch(userConfig).then(function (ok) {
      if (!ok) writeUserConfig(userConfig);
    });
    root.setTimeout(function () { sendSwitch(userConfig); }, 600);
  }

  function installShortcutHotkey() {
    if (!inTopFrame() || isExtensionDocument()) return;
    var cached = null;
    var generation = 0;
    var lastToggleAt = 0;
    function remember(config) {
      cached = { config: config, setting: shortcutSetting(config) };
    }
    function refresh() {
      var ticket = ++generation;
      return readUserConfig().then(function (config) {
        if (ticket !== generation) return;
        remember(config);
      }).catch(function () {});
    }
    refresh();
    root.setTimeout(refresh, 800);
    var runtime = extensionRuntime();
    var onChanged = runtime && runtime.storage && runtime.storage.onChanged;
    if (onChanged && typeof onChanged.addListener === "function") {
      onChanged.addListener(function (changes, area) {
        if (area === "local" && changes && changes[USER_CONFIG_KEY]) refresh();
      });
    }
    window.addEventListener("keydown", function (event) {
      if (event.repeat || !cached || !cached.setting) return;
      if (eventToShortcut(event) !== cached.setting.shortcut) return;
      if (Date.now() - lastToggleAt < 400) return;
      lastToggleAt = Date.now();
      event.preventDefault();
      event.stopPropagation();
      var config = cached.config;
      loadCatalog(config).then(function (catalog) {
        var next = toggleActiveService(config, catalog);
        if (!next) return;
        generation += 1;
        remember(next);
        deliverSwitch(next);
      }).catch(function () {});
    }, true);
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
      "#imt-fork-service-switch label{min-width:7em;}",
      "#imt-fork-service-switch select,#imt-fork-service-switch input{flex:1;margin:0;}",
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

    function refreshNote() {
      if (!readyNote) return;
      var text = uiText();
      var setting = shortcutSetting({
        serviceSwitch: {
          shortcut: shortcutInput.value,
          serviceA: serviceA.value,
          serviceB: serviceB.value,
        },
      });
      readyNote.textContent = setting ? text.ready : text.idle;
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
        if (serviceSwitch.shortcut) serviceSwitch.shortcut = normalizeShortcut(serviceSwitch.shortcut);
        root.__imtForkHeldServiceSwitch = serviceSwitch;
        var next = Object.assign({}, config, { serviceSwitch: serviceSwitch });
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
      shortcutInput = document.createElement("input");
      shortcutInput.type = "text";
      shortcutInput.readOnly = true;
      shortcutInput.placeholder = text.record;
      shortcutInput.setAttribute("aria-label", text.shortcut);
      serviceA = document.createElement("select");
      serviceA.setAttribute("aria-label", text.serviceA);
      serviceB = document.createElement("select");
      serviceB.setAttribute("aria-label", text.serviceB);
      status = document.createElement("p");
      status.className = "imt-fork-status";
      status.setAttribute("role", "status");

      function row(labelText, control, extra) {
        var wrap = document.createElement("div");
        wrap.className = "imt-fork-row";
        var label = document.createElement("label");
        label.textContent = labelText;
        wrap.appendChild(label);
        wrap.appendChild(control);
        if (extra) wrap.appendChild(extra);
        return wrap;
      }

      var clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = text.clear;
      clear.addEventListener("click", function () {
        shortcutInput.value = "";
        save({ shortcut: "" }, text.saved);
      });
      shortcutInput.addEventListener("keydown", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape" || event.key === "Backspace" || event.key === "Delete") {
          shortcutInput.value = "";
          save({ shortcut: "" }, text.saved);
          return;
        }
        var combo = eventToShortcut(event);
        if (!combo) return;
        if (!isUsableShortcut(combo)) {
          status.textContent = text.invalid;
          return;
        }
        shortcutInput.value = combo;
        save({ shortcut: combo }, text.saved);
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
      panel.appendChild(row(text.shortcut, shortcutInput, clear));
      panel.appendChild(row(text.serviceA, serviceA));
      panel.appendChild(row(text.serviceB, serviceB));
      panel.appendChild(status);
      refreshNote();
      return panel;
    }

    function applyConfig(config) {
      var setting = (config && config.serviceSwitch) || {};
      shortcutInput.value = normalizeShortcut(setting.shortcut || "");
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

  if (isExtensionDocument()) {
    installStoragePreserve();
    installSubscriptionRemoval();
    if (isOptionsDocument()) installShortcutSettings();
  } else {
    installSubscriptionRemoval();
    installShortcutHotkey();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
