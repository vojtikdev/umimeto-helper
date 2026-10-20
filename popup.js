const $ = (id) => document.getElementById(id);
let tabId,
  ready = false,
  busy = false;
function status(text, error = false) {
  $("status").textContent = text;
  $("status").dataset.error = String(error);
}
async function send(data) {
  const r = await chrome.runtime.sendMessage(data);
  if (r?.error) throw Error(r.error);
  return r;
}
async function panel(action) {
  if (!tabId) throw Error("Open an Umíme exercise first.");
  return chrome.tabs.sendMessage(tabId, { type: "panelAction", action });
}
async function refresh() {
  try {
    const info = await panel("status");
    if (!info?.ready) throw Error();
    ready = true;
    busy = info.busy;
    $("state").textContent = busy
      ? "Working on your answer"
      : info.hasQuestion
        ? "Ready to practice"
        : "Choose a question";
    $("detail").textContent = info.hasQuestion
      ? `${info.choices} choices detected · ${info.cached} session answers${info.paused ? " · auto paused" : ""}`
      : "Open an exercise, or use selection in the page panel.";
    for (const id of ["toggle", "scan", "clear", "hide"])
      $(id).disabled = false;
    $("ask").disabled = busy || !info.configured;
    $("stop").disabled = !busy;
    $("stop").hidden = !busy;
    if (info.hidden) {
      $("state").textContent = "Widget hidden";
      $("detail").textContent =
        "Automation paused in this tab. Open the panel to continue.";
    }
  } catch {
    ready = false;
    for (const id of ["ask", "toggle", "scan", "stop", "clear", "hide"])
      $(id).disabled = true;
    $("stop").hidden = true;
    $("state").textContent = "Open an Umíme exercise";
    $("detail").textContent =
      "On a supported site already? Refresh its page after installing or updating the extension.";
  }
}
async function init() {
  const { settings: s } = await send({ type: "settings" });
  document.documentElement.dataset.theme = s.theme || "auto";
  if (/^#[0-9a-f]{6}$/i.test(s.accent || "")) {
    const c = s.accent
      .slice(1)
      .match(/../g)
      .map((h) => parseInt(h, 16) / 255)
      .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    document.documentElement.style.setProperty("--accent", s.accent);
    document.documentElement.style.setProperty(
      "--ink",
      0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.179 ? "#000" : "#fff",
    );
  }
  $("ask").textContent = s.hintFirst ? "Get a hint" : "Ask AI ↗";
  $("profile").replaceChildren();
  for (const p of s.profiles) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name + " · " + p.model;
    $("profile").append(o);
  }
  if (!s.profiles.length) {
    const o = document.createElement("option");
    o.textContent = "Add your first model in Settings";
    $("profile").append(o);
  }
  $("profile").value = s.activeProfileId;
  $("profile").disabled = s.profiles.length < 2;
  $("auto").checked = s.autoSolve;
  $("auto").disabled = !s.configured;
  $("clickNotice").hidden = !s.autoClick;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  await refresh();
  if (!s.configured) status("Connect your first model in Settings.");
}
for (const action of ["ask", "toggle", "scan", "stop", "clear", "hide"])
  $(action).onclick = async () => {
    try {
      await panel(
        action === "clear"
          ? "clearCache"
          : action === "toggle"
            ? "show"
            : action,
      );
      status(
        action === "clear"
          ? "Cached answers cleared; auto paused in this tab."
          : action === "stop"
            ? "Request stopped."
            : action === "ask"
              ? "Answer requested. Open the page panel to view it."
              : "",
      );
      await refresh();
    } catch {
      status(
        "Could not reach the page. Refresh the exercise and try again.",
        true,
      );
    }
  };
$("profile").onchange = async () => {
  try {
    await send({ type: "setActiveProfile", id: $("profile").value });
    status("Model changed.");
  } catch (e) {
    status(e.message, true);
  }
};
$("auto").onchange = async () => {
  try {
    await send({ type: "setAutoSolve", enabled: $("auto").checked });
    status(
      $("auto").checked
        ? "Automatic answers enabled."
        : "Automatic answers off.",
    );
  } catch (e) {
    $("auto").checked = !$("auto").checked;
    status(e.message, true);
  }
};
$("settings").onclick = () => chrome.runtime.openOptionsPage();
$("help").onclick = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html#tools") });
init().catch((e) => status(e.message, true));
const poll = setInterval(() => {
  if (tabId) refresh();
}, 1500);
window.addEventListener("unload", () => clearInterval(poll));

async function usageSummary() {
  try {
    const { usage } = await send({ type: "usage" });
    $("popupTokens").textContent = (
      usage.today.input + usage.today.output
    ).toLocaleString();
    $("popupRequests").textContent = usage.today.requests.toLocaleString();
    $("popupCost").textContent =
      "Estimated: " +
      (Object.entries(usage.today.costs || {})
        .map(([currency, amount]) => Number(amount).toFixed(6) + " " + currency)
        .join(" + ") || "set model prices in Settings");
    $("popupUnknown").textContent = usage.today.unknown + " with unknown usage";
  } catch {
    $("popupUnknown").textContent = "Open Settings for usage";
  }
}
usageSummary();

$("history").onclick = () =>
  chrome.tabs.create({ url: chrome.runtime.getURL("options.html#history") });