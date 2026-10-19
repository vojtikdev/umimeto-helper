const $ = (id) => document.getElementById(id);
const connectionFields = [
  "endpoint",
  "model",
  "apiKey",
  "profiles",
  "activeProfileId",
];
const preferenceFields = Object.keys(Umime.defaults).filter(
  (k) => !connectionFields.includes(k),
);
let profilesPersisted = false,
  profiles = [],
  activeId = "",
  editingId = "",
  dirty = false,
  removeArmed = false,
  toastTimer;
function notify(text, error = false) {
  clearTimeout(toastTimer);
  $("status").hidden = false;
  $("status").textContent = text;
  $("status").dataset.error = String(error);
  if (!error) toastTimer = setTimeout(() => ($("status").hidden = true), 6500);
}
async function send(m) {
  const r = await chrome.runtime.sendMessage(m);
  if (r?.error) throw Error(r.error);
  return r;
}
function switchTab(name) {
  if (
    ![
      "models",
      "automation",
      "appearance",
      "detection",
      "tools",
      "usage",
      "history",
    ].includes(name)
  )
    name = "models";
  document
    .querySelectorAll(".tabpage")
    .forEach((el) => (el.hidden = el.id !== "tab-" + name));
  document.querySelectorAll("[data-tab]").forEach((el) => {
    const selected = el.dataset.tab === name;
    el.classList.toggle("active", selected);
    if (selected) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  $("savebar").hidden = name === "models" || name === "tools";
  $("breadcrumb").textContent = name[0].toUpperCase() + name.slice(1);
}
document.querySelectorAll("[data-tab]").forEach(
  (el) =>
    (el.onclick = () => {
      location.hash = el.dataset.tab;
      switchTab(el.dataset.tab);
    }),
);
window.addEventListener("hashchange", () => switchTab(location.hash.slice(1)));
for (const [id, p] of Object.entries(Umime.providers)) {
  const option = document.createElement("option");
  option.value = id;
  option.textContent = p.name;
  $("provider").append(option);
}
function draft() {
  return {
    id: editingId || crypto.randomUUID(),
    name: $("profileName").value.trim(),
    provider: $("provider").value,
    endpoint: $("endpoint").value.trim(),
    model: $("model").value.trim(),
    apiKey: $("apiKey").value.trim(),
    noKey: $("auth").value === "none",
    vision: $("vision").checked,
    tokenField: $("tokenField").value,
    inputRate: $("inputRate").value,
    outputRate: $("outputRate").value,
    cachedRate: $("cachedRate").value,
    currency: $("currency").value,
  };
}
function fingerprint() {
  return JSON.stringify(draft());
}
function authUI() {
  $("apiKey").disabled = $("auth").value === "none";
  $("keyField").style.opacity = $("auth").value === "none" ? ".5" : "1";
}
function clearModels() {
  $("modelList").replaceChildren();
  $("modelHint").textContent =
    "Enter any compatible text model ID, or fetch your provider’s list.";
}
function populate(p) {
  editingId = p.id;
  for (const [field, key] of [
    ["profileName", "name"],
    ["endpoint", "endpoint"],
    ["model", "model"],
    ["apiKey", "apiKey"],
  ])
    $(field).value = p[key] || "";
  for (const field of ["inputRate", "outputRate", "cachedRate"])
    $(field).value = p[field] ?? "";
  $("currency").value = p.currency || "USD";
  $("vision").checked = p.vision === true;
  $("tokenField").value =
    p.tokenField ||
    (String(p.endpoint).includes("api.openai.com")
      ? "max_completion_tokens"
      : "max_tokens");
  $("provider").value = Umime.providers[p.provider] ? p.provider : "custom";
  $("auth").value = p.noKey ? "none" : "key";
  $("apiKey").type = "password";
  $("showKey").textContent = "Show";
  $("showKey").setAttribute("aria-pressed", "false");
  $("providerHelp").textContent = Umime.providers[$("provider").value].hint;
  authUI();
  clearModels();
  dirty = false;
  removeArmed = false;
  const saved = profiles.some((x) => x.id === p.id);
  $("modelEditor").open = !saved;
  $("editorTitle").textContent = saved ? "Edit model profile" : "Add a model";
  $("deleteProfile").hidden = !saved;
  $("deleteProfile").textContent = "Remove profile";
  $("draftState").textContent = saved ? "SAVED PROFILE" : "NEW PROFILE";
}
function mayDiscard() {
  return (
    !dirty || window.confirm("Discard unsaved changes to this model profile?")
  );
}
function newProfile() {
  if (!mayDiscard()) return;
  populate({
    id: crypto.randomUUID(),
    name: "",
    provider: "custom",
    endpoint: "",
    model: "",
    apiKey: "",
    noKey: false,
  });
  switchTab("models");
  $("profileName").focus();
}
function renderProfiles() {
  $("profiles").replaceChildren();
  $("profileCount").textContent = profiles.length;
  const active = profiles.find((p) => p.id === activeId);
  $("activeSummary").textContent =
    active?.model && (active.apiKey || active.noKey)
      ? active.name + " · ready"
      : "Set up a model";
  if (!profiles.length) {
    const p = document.createElement("p");
    p.className = "hint";
    p.textContent = "No saved models yet. Add your first connection below.";
    $("profiles").append(p);
  }
  for (const p of profiles) {
    const card = document.createElement("article");
    card.className = "profile-card" + (p.id === activeId ? " active" : "");
    card.innerHTML =
      '<div class="profile-top"><span class="provider-badge"></span><span class="pill"></span></div><h3></h3><div class="model-id"></div><div class="profile-actions"><button type="button" class="secondary use"></button><button type="button" class="text-button edit">Edit profile ↗</button></div>';
    card.querySelector(".provider-badge").textContent =
      Umime.providers[p.provider]?.name || "Custom provider";
    card.querySelector(".pill").textContent =
      p.id === activeId ? "ACTIVE" : "SAVED";
    card.querySelector("h3").textContent = p.name;
    card.querySelector(".model-id").textContent = p.model || "Choose a model";
    const use = card.querySelector(".use");
    use.textContent = p.id === activeId ? "✓ In use" : "Use model";
    use.disabled = p.id === activeId;
    use.onclick = async () => {
      try {
        await chrome.storage.local.set({
          activeProfileId: p.id,
          ...(profilesPersisted ? {} : { profiles, apiKey: "" }),
        });
        profilesPersisted = true;
        activeId = p.id;
        renderProfiles();
        notify(p.name + " is now active.");
      } catch (e) {
        notify(e.message, true);
      }
    };
    card.querySelector(".edit").onclick = () => {
      if (mayDiscard()) {
        populate(p);
        $("modelEditor").open = true;
        $("profileName").focus();
      }
    };
    $("profiles").append(card);
  }
}
function preview() {
  const light =
    $("theme").value === "light" ||
    ($("theme").value === "auto" &&
      matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
  const box = $("preview"),
    accent = $("accent").value || "#a3e635";
  const values = light
    ? {
        "--pbg": "#f6f8fc",
        "--pfg": "#172439",
        "--psurface": "#ffffff",
        "--pborder": "#d5dfea",
      }
    : {
        "--pbg": "#0d1728",
        "--pfg": "#eff5ff",
        "--psurface": "#152238",
        "--pborder": "#30425b",
      };
  for (const [key, value] of Object.entries(values))
    box.style.setProperty(key, value);
  const c = accent
    .slice(1)
    .match(/../g)
    .map((h) => parseInt(h, 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  box.style.setProperty("--paccent", accent);
  box.style.setProperty(
    "--pcontrast",
    0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.179 ? "#000" : "#fff",
  );
  box.style.fontSize =
    Math.max(12, Math.min(20, Number($("fontSize").value) || 14)) + "px";
  $("previewAnswer").style.fontSize =
    Math.max(22, Math.min(44, Number($("answerSize").value) || 30)) + "px";
  $("previewExplanation").hidden = !$("showExplanation").checked;
}
function fillPreferences(s) {
  for (const k of preferenceFields) {
    if (
      k === "autoDelay" &&
      ![...$(k).options].some((o) => o.value === String(s[k]))
    ) {
      const o = document.createElement("option");
      o.value = s[k];
      o.textContent = "Custom · " + s[k] + " ms";
      $(k).append(o);
    }
    $(k).type === "checkbox" ? ($(k).checked = s[k]) : ($(k).value = s[k]);
  }
  preview();
}
async function load() {
  await chrome.storage.local.setAccessLevel({
    accessLevel: "TRUSTED_CONTEXTS",
  });
  const s = await chrome.storage.local.get(Umime.defaults);
  profilesPersisted = Array.isArray(s.profiles);
  profiles = Array.isArray(s.profiles)
    ? s.profiles
    : s.apiKey
      ? [{ ...Umime.connection(s), name: "My model" }]
      : [];
  activeId = s.activeProfileId || profiles[0]?.id;
  fillPreferences(s);
  renderProfiles();
  if (profiles.length)
    populate(profiles.find((p) => p.id === activeId) || profiles[0]);
  else newProfile();
  switchTab(location.hash.slice(1));
}
$("provider").onchange = () => {
  for (const field of ["inputRate", "outputRate", "cachedRate"])
    $(field).value = "";
  const p = Umime.providers[$("provider").value];
  $("vision").checked = false;
  $("tokenField").value =
    $("provider").value === "openai" ? "max_completion_tokens" : "max_tokens";
  $("endpoint").value = p.base;
  $("model").value = p.model;
  $("apiKey").value = "";
  $("auth").value = p.noKey ? "none" : "key";
  if (!$("profileName").value.trim()) $("profileName").value = p.name;
  $("providerHelp").textContent = p.hint;
  authUI();
  clearModels();
};
$("auth").onchange = authUI;
$("endpoint").addEventListener("input", clearModels);
$("showKey").onclick = () => {
  const show = $("apiKey").type === "password";
  $("apiKey").type = show ? "text" : "password";
  $("showKey").textContent = show ? "Hide" : "Show";
  $("showKey").setAttribute("aria-pressed", String(show));
  $("showKey").setAttribute(
    "aria-label",
    show ? "Hide API key" : "Show API key",
  );
};
for (const event of ["input", "change"])
  $("settings").addEventListener(event, () => {
    dirty = true;
    $("draftState").textContent = "UNSAVED";
  });
$("newProfile").onclick = newProfile;
$("settings").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const p = Umime.validateConnection(draft());
    for (const field of ["inputRate", "outputRate", "cachedRate"]) {
      if (
        p[field] !== "" &&
        (!Number.isFinite(Number(p[field])) ||
          Number(p[field]) < 0 ||
          Number(p[field]) > 1000000)
      )
        throw Error("Prices must be between 0 and 1,000,000, or blank.");
    }
    if (!p.name) throw Error("Give this profile a name.");
    if (profiles.length >= 16 && !profiles.some((x) => x.id === p.id))
      throw Error(
        "You can save up to 16 model profiles. Remove an unused one first.",
      );
    // Request permission directly from the user's click, before storage/network awaits.
    if (
      !(await chrome.permissions.request({
        origins: [Umime.origin(Umime.endpoint(p.endpoint))],
      }))
    )
      throw Error("API host access was not granted. Profile was not saved.");
    const next = profiles.filter((x) => x.id !== p.id);
    next.push(p);
    await chrome.storage.local.set({
      profiles: next,
      activeProfileId: p.id,
      apiKey: "",
      endpoint: p.endpoint,
      model: p.model,
    });
    profilesPersisted = true;
    profiles = next;
    activeId = p.id;
    renderProfiles();
    populate(p);
    notify("Saved. " + p.name + " is now the active model.");
  } catch (e) {
    notify(e.message, true);
  }
});
$("fetchModels").onclick = async () => {
  const button = $("fetchModels");
  try {
    const p = Umime.validateConnection(draft(), false),
      stamp = fingerprint();
    const permission = chrome.permissions.request({
      origins: [Umime.origin(Umime.endpoint(p.endpoint))],
    });
    button.disabled = true;
    button.textContent = "Fetching models…";
    if (!(await permission))
      throw Error("Allow API host access to fetch models.");
    const { models } = await send({ type: "listModels", profile: p });
    if (stamp !== fingerprint()) return;
    $("modelList").replaceChildren();
    for (const id of models) {
      const o = document.createElement("option");
      o.value = id;
      $("modelList").append(o);
    }
    $("modelHint").textContent = models.length
      ? `${models.length} models found. Click the model field and type to filter. Choose a text/chat model; lists may include image or embedding models.`
      : "No models returned. Enter a model ID manually, or load a model in your local server.";
    $("model").focus();
    notify(models.length + " models loaded. Pick one in the model field.");
  } catch (e) {
    notify(e.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "↻ Fetch available models";
  }
};
$("testConnection").onclick = async () => {
  const button = $("testConnection");
  try {
    const p = Umime.validateConnection(draft()),
      stamp = fingerprint();
    const permission = chrome.permissions.request({
      origins: [Umime.origin(Umime.endpoint(p.endpoint))],
    });
    button.disabled = true;
    button.textContent = "Testing…";
    if (!(await permission))
      throw Error("Allow API host access to test this model.");
    const result = await send({ type: "testConnection", profile: p });
    if (stamp !== fingerprint()) return;
    notify(
      `Connection works · ${result.model} · ${(result.elapsedMs / 1000).toFixed(1)}s. Save to use this profile.`,
    );
  } catch (e) {
    notify(e.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Test connection";
  }
};
$("deleteProfile").onclick = async () => {
  if (!removeArmed) {
    removeArmed = true;
    $("deleteProfile").textContent = "Click again to remove";
    return;
  }
  try {
    const next = profiles.filter((p) => p.id !== editingId),
      nextId = activeId === editingId ? next[0]?.id || "" : activeId;
    await chrome.storage.local.set({
      profiles: next,
      activeProfileId: nextId,
      apiKey: "",
      ...(next.length ? {} : { autoSolve: false }),
    });
    profilesPersisted = true;
    profiles = next;
    activeId = nextId;
    dirty = false;
    renderProfiles();
    if (next.length) populate(next.find((p) => p.id === activeId) || next[0]);
    else newProfile();
    notify("Profile and its saved key removed.");
  } catch (e) {
    notify(e.message, true);
  }
};
$("preferences").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const s = Object.fromEntries(
      preferenceFields.map((k) => [
        k,
        $(k).type === "checkbox" ? $(k).checked : $(k).value,
      ]),
    );
    for (const [k, min, max, label] of [
      ["fontSize", 12, 20, "Interface text size"],
      ["answerSize", 22, 44, "Answer text size"],
      ["panelWidth", 320, 520, "Panel width"],
      ["autoDelay", 500, 10000, "Settling delay"],
      ["outputLimit", 128, 4096, "Output token cap"],
      ["dailyRequestLimit", 0, 10000, "Daily request limit"],
      ["dailyTokenLimit", 0, 10000000, "Token threshold"],
      ["imageSize", 768, 1600, "Image size"],
      ["historyDays", 1, 30, "History days"],
      ["historyLimit", 10, 100, "History entries"],
    ]) {
      s[k] = Number(s[k]);
      if (!Number.isInteger(s[k]) || s[k] < min || s[k] > max) {
        switchTab(
          k.startsWith("history")
            ? "history"
            : [
                  "outputLimit",
                  "dailyRequestLimit",
                  "dailyTokenLimit",
                  "imageSize",
                ].includes(k)
              ? "usage"
              : k === "autoDelay"
                ? "automation"
                : "appearance",
        );
        $(k).focus();
        throw Error(label + " must be between " + min + " and " + max + ".");
      }
    }
    for (const k of ["questionSelector", "choicesSelector"]) {
      try {
        if (!s[k].trim()) throw Error();
        document.querySelector(s[k]);
      } catch {
        switchTab("detection");
        $(k).focus();
        throw Error(
          (k === "questionSelector" ? "Question" : "Choice") +
            " selector is invalid. Check its CSS syntax.",
        );
      }
    }
    await chrome.storage.local.set(s);
    preferencesDirty = false;
    $("preferenceState").textContent = "All preferences saved.";
    notify("Preferences saved. Return to your exercise to apply them.");
  } catch (e) {
    notify(e.message, true);
  }
});
$("preferences").addEventListener("input", () => {
  $("preferenceState").textContent = "You have unsaved preferences.";
  preview();
});
$("preferences").addEventListener("change", preview);
$("reset").onclick = async () => {
  const p = Object.fromEntries(
    preferenceFields.map((k) => [k, Umime.defaults[k]]),
  );
  await chrome.storage.local.set(p);
  fillPreferences(p);
  preferencesDirty = false;
  $("preferenceState").textContent = "Preferences reset. Models and keys kept.";
  notify("Preferences reset; automation is off. Model profiles kept.");
};
matchMedia("(prefers-color-scheme: light)").addEventListener("change", preview);
load().catch((e) => notify(e.message, true));

chrome.storage.onChanged?.addListener(async (changes, area) => {
  if (
    area !== "local" ||
    !("profiles" in changes || "activeProfileId" in changes)
  )
    return;
  const s = await chrome.storage.local.get(Umime.defaults);
  if (Array.isArray(s.profiles)) {
    profilesPersisted = true;
    profiles = s.profiles;
    activeId = s.activeProfileId;
    renderProfiles();
  }
});

let stagedImport = [],
  preferencesDirty = false;
$("preferences").addEventListener("input", () => (preferencesDirty = true));
window.addEventListener("beforeunload", (e) => {
  if (dirty || preferencesDirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
$("exportModels").onclick = () => {
  if (!profiles.length) {
    notify("Add a model profile before exporting.", true);
    return;
  }
  const blob = new Blob(
    [JSON.stringify(Umime.exportPresets(profiles), null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "umime-model-presets.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Model presets exported without API keys.");
};
$("chooseImport").onclick = () => $("importFile").click();
$("importFile").onchange = async () => {
  try {
    stagedImport = [];
    $("importReview").hidden = true;
    const file = $("importFile").files[0];
    if (!file) return;
    if (file.size > 100000)
      throw Error("Choose a preset JSON file smaller than 100 KB.");
    stagedImport = Umime.importPresets(await file.text());
    if (profiles.length + stagedImport.length > 16)
      throw Error(
        "Import would exceed 16 profiles. Remove unused profiles first.",
      );
    $("importList").replaceChildren();
    for (const p of stagedImport) {
      const li = document.createElement("li");
      li.textContent =
        p.name +
        " · " +
        p.model +
        " · " +
        new URL(p.endpoint).host +
        (p.noKey ? " · no authentication" : " · needs API key");
      $("importList").append(li);
    }
    $("importReview").hidden = false;
  } catch (e) {
    stagedImport = [];
    notify(e.message, true);
  } finally {
    $("importFile").value = "";
  }
};
$("cancelImport").onclick = () => {
  stagedImport = [];
  $("importReview").hidden = true;
};
$("confirmImport").onclick = async () => {
  const button = $("confirmImport");
  button.disabled = true;
  try {
    if (!stagedImport.length) return;
    const s = await chrome.storage.local.get(Umime.defaults),
      current = Umime.connections(s);
    if (current.length + stagedImport.length > 16)
      throw Error("Too many profiles. Remove unused profiles and try again.");
    // Keep the current selection. On a fresh install, disable auto until setup is reviewed.
    const next = [...current, ...stagedImport];
    await chrome.storage.local.set({
      profiles: next,
      activeProfileId: s.activeProfileId || current[0]?.id || next[0]?.id || "",
      apiKey: "",
      ...(current.length ? {} : { autoSolve: false, autoClick: false }),
    });
    profiles = next;
    profilesPersisted = true;
    activeId = s.activeProfileId || current[0]?.id || next[0]?.id || "";
    renderProfiles();
    stagedImport = [];
    $("importReview").hidden = true;
    notify(
      "Presets imported. Edit a profile, add its key if needed, then Save & use.",
    );
  } catch (e) {
    notify(e.message, true);
  } finally {
    button.disabled = false;
  }
};
$("diagnose").onclick = async () => {
  try {
    const s = await chrome.storage.local.get(Umime.defaults),
      p = Umime.connection(s),
      lines = [
        "Umíme Helper " + chrome.runtime.getManifest().version,
        "Local checks · " + new Date().toISOString(),
        "Saved profiles: " + Umime.connections(s).length,
      ];
    try {
      const url = Umime.endpoint(p.endpoint);
      lines.push(
        "API address: valid",
        "API host access: " +
          ((await chrome.permissions.contains({ origins: [Umime.origin(url)] }))
            ? "granted"
            : "missing"),
      );
    } catch {
      lines.push("API address: needs setup");
    }
    lines.push(
      "Model ID: " + (p.model ? "present" : "missing"),
      "Authentication: " +
        (p.noKey
          ? "no key required"
          : p.apiKey
            ? "key present (not shown)"
            : "key missing"),
      "Automatic answers: " + (s.autoSolve ? "on" : "off"),
      "Automatic clicks: " + (s.autoClick ? "on" : "off"),
    );
    for (const k of ["questionSelector", "choicesSelector"]) {
      try {
        document.querySelector(s[k]);
        lines.push(k + ": valid syntax");
      } catch {
        lines.push(k + ": invalid syntax");
      }
    }
    lines.push(
      "No network test performed. Use Test connection to check the provider.",
    );
    $("diagnostics").textContent = lines.join("\n");
    $("copyReport").disabled = false;
    notify("Local checks complete.");
  } catch (e) {
    notify(e.message, true);
  }
};
$("copyReport").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("diagnostics").textContent);
    notify("Diagnostic report copied.");
  } catch {
    notify("Clipboard unavailable. Select and copy the report manually.", true);
  }
};

async function refreshUsage() {
  try {
    const { usage } = await send({ type: "usage" }),
      v = usage.today;
    $("totalTokens").textContent = (v.input + v.output).toLocaleString();
    $("totalRequests").textContent = v.requests.toLocaleString();
    $("cachedTokens").textContent = v.cached.toLocaleString();
    $("usageDate").textContent = usage.day;
    $("costSummary").textContent =
      "Estimated cost: " +
      (Object.entries(v.costs || {})
        .map(([currency, amount]) => Umime.costLabel({ currency, amount }))
        .join(" + ") || "Not estimated") +
      " · " +
      (v.unpriced || 0) +
      " attempts without a cost estimate. Rates are set per model.";
    $("usageSummary").textContent =
      `${v.input.toLocaleString()} input · ${v.output.toLocaleString()} output · ${v.reported} metered · ${v.unknown} with unknown usage · ${v.failed} failed. Pending requests may not yet have usage.`;
    const cap = Number($("dailyTokenLimit").value);
    $("tokenProgress").max = cap || Math.max(1, v.input + v.output);
    $("tokenProgress").value = v.input + v.output;
    $("tokenProgress").setAttribute(
      "aria-label",
      "Reported tokens against token threshold",
    );
    $("usageRows").replaceChildren();
    for (const [day, row] of Object.entries(usage.days).sort(([a], [b]) =>
      b.localeCompare(a),
    )) {
      const tr = document.createElement("tr");
      for (const value of [
        day,
        row.requests,
        row.input,
        row.output,
        row.unknown,
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      $("usageRows").append(tr);
    }
  } catch (e) {
    $("usageSummary").textContent = e.message;
  }
}
$("refreshUsage").onclick = refreshUsage;
let resetUsageArmed = false;
$("resetUsage").onclick = async () => {
  if (!resetUsageArmed) {
    resetUsageArmed = true;
    $("resetUsage").textContent =
      "Click again to reset counters and daily guards";
    return;
  }
  try {
    await send({ type: "resetUsage" });
    resetUsageArmed = false;
    $("resetUsage").textContent = "Reset local counters";
    await refreshUsage();
    notify("Local usage reset. Provider billing is unchanged.");
  } catch (e) {
    notify(e.message, true);
  }
};
refreshUsage();

let historyEntries = [],
  clearHistoryArmed = false;
function renderHistory() {
  const q = $("historySearch").value.toLocaleLowerCase().trim(),
    filtered = historyEntries.filter((e) =>
      [e.question, e.answer, e.explanation, e.model]
        .join(" ")
        .toLocaleLowerCase()
        .includes(q),
    );
  $("historyCount").textContent =
    filtered.length +
    " of " +
    historyEntries.length +
    " entries" +
    (!historyEntries.length
      ? " · Your next saved hint or answer appears here."
      : "");
  $("historyList").replaceChildren();
  for (const entry of filtered) {
    const card = document.createElement("details");
    card.className = "history-entry";
    const summary = document.createElement("summary");
    summary.textContent = entry.question || "Image question";
    card.append(summary);
    const meta = document.createElement("p");
    meta.className = "hint";
    meta.textContent =
      new Date(entry.time).toLocaleString() +
      " · " +
      entry.model +
      " · " +
      (entry.mode === "hint" ? "Hint" : "Answer") +
      (entry.imageCount
        ? " · " + entry.imageCount + " images (not stored)"
        : "");
    card.append(meta);
    const answer = document.createElement("p");
    answer.className = "history-answer";
    answer.textContent = entry.answer;
    card.append(answer);
    const explanation = document.createElement("p");
    explanation.textContent = entry.explanation;
    card.append(explanation);
    if (entry.choices.length) {
      const choices = document.createElement("ol");
      for (const text of entry.choices) {
        const li = document.createElement("li");
        li.textContent = text;
        choices.append(li);
      }
      card.append(choices);
    }
    const cost = document.createElement("p");
    cost.className = "hint";
    cost.textContent =
      "Cost estimate: " +
      Umime.costLabel(entry.cost) +
      (entry.usage
        ? " · " + entry.usage.total + " reported tokens"
        : " · usage not reported");
    card.append(cost);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "text-button";
    copy.textContent = "Copy";
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(entry.answer);
        notify("Copied.");
      } catch {
        notify("Clipboard unavailable. Select the text to copy.", true);
      }
    };
    card.append(copy);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "Delete entry";
    remove.onclick = async () => {
      try {
        const r = await send({ type: "deleteHistory", id: entry.id });
        historyEntries = r.entries;
        renderHistory();
      } catch (e) {
        notify(e.message, true);
      }
    };
    card.append(remove);
    $("historyList").append(card);
  }
}
async function refreshHistory() {
  try {
    const r = await send({ type: "history" });
    historyEntries = r.entries;
    renderHistory();
  } catch (e) {
    $("historyCount").textContent = e.message;
  }
}
$("historySearch").oninput = renderHistory;
$("refreshHistory").onclick = refreshHistory;
$("clearHistory").onclick = async () => {
  if (!clearHistoryArmed) {
    clearHistoryArmed = true;
    $("clearHistory").textContent = "Confirm clear";
    return;
  }
  try {
    await send({ type: "clearHistory" });
    clearHistoryArmed = false;
    $("clearHistory").textContent = "Clear history";
    await refreshHistory();
  } catch (e) {
    notify(e.message, true);
  }
};
$("exportHistory").onclick = () => {
  if (!historyEntries.length) {
    notify("No history to export.");
    return;
  }
  const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              format: "umime-helper-history",
              version: 1,
              entries: historyEntries,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "umime-study-history.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("History exported. This file contains your saved study text.");
};
window.addEventListener("hashchange", () => {
  if (location.hash === "#history") refreshHistory();
});
refreshHistory();
