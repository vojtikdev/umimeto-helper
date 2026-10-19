(async () => {
  if (document.getElementById("umime-helper-extension")) return;
  const host = document.createElement("div");
  host.id = "umime-helper-extension";
  host.style.cssText =
    "all:initial;position:fixed!important;bottom:18px!important;right:18px!important;z-index:2147483647!important;";
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `<style>${Umime.panelCSS || ""}</style>
    <section class="panel" id="panel" aria-label="Umíme Helper">
      <div class="panel-kicker">
        PRACTICE WORKSPACE <span>02 / VISION</span>
      </div>
      <div class="bar">
        <span class="brand">u</span>
        <strong>Umíme Helper</strong>
        <button id="close" aria-label="Minimize to launcher" title="Minimize to launcher">−</button>
        <button id="hideAll" aria-label="Hide widget" title="Hide widget · reopen from toolbar or shortcut">Hide</button>
      </div>
      <p id="questionPreview" class="question-preview">Open a question to begin.</p>

      <section class="result" id="result" hidden aria-label="Suggested answer" aria-live="polite">
        <div class="eyebrow" id="confidence">Suggested answer</div>
        <div id="answer"></div>
        <div id="matched"></div>
        <button id="reveal" class="ask" hidden>Show answer</button>
        <p id="hintNote" class="note" hidden>
          Requests the full answer separately; may use additional tokens.
        </p>
        <details class="explanation" id="reason">
          <summary>Why this answer?</summary>
          <p id="explanation"></p>
        </details>
        <div class="result-footer">
          <span id="answerMeta"></span>
          <button class="copy" id="copy">Copy answer</button>
        </div>
      </section>

      <div class="row">
        <button id="setup" class="ask" hidden>Connect a model</button>
        <button id="ask" class="ask">Ask AI ↗</button>
      </div>
      <div class="row"><button id="stop" hidden>Stop request</button></div>
      <div id="status" role="status" aria-live="polite">Detecting question…</div>
      <div class="row" id="recovery" hidden>
        <button id="retry">Retry answer</button>
        <button id="fixSettings">Check settings ↗</button>
      </div>

      <details id="source">
        <summary id="sourceSummary">Review question</summary>
        <label for="question">QUESTION</label>
        <textarea id="question" rows="3" maxlength="10000" placeholder="Open an exercise or paste your question here."></textarea>
        <label for="choices">POSSIBLE ANSWERS · one per line</label>
        <textarea id="choices" rows="2" placeholder="Leave empty for a written answer"></textarea>
        <div class="row">
          <button id="scan">Refresh from page</button>
          <button id="selection">Use selected text</button>
        </div>
      </details>

      <details class="attachments" id="attachmentArea">
        <summary>Images <span id="attachmentCount"></span></summary>
        <div class="attachment-head">
          <strong>Visual context</strong>
          <label class="inline"><input id="includeImages" type="checkbox" checked /> Include images</label>
        </div>
        <div id="imageList"></div>
        <p id="imageStatus" class="note">Images attached to the exercise appear here.</p>
        <div class="row">
          <button id="uploadImage">＋ Upload image</button>
          <button id="confirmImages" hidden>Use these attachments</button>
        </div>
        <input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden />
      </details>

      <details id="more">
        <summary id="moreSummary">More options</summary>
        <div class="connection">
          <div class="model-field">
            <label for="profile">ACTIVE MODEL</label>
            <select id="profile" aria-label="Active model profile"></select>
          </div>
          <button id="manageModels" title="Manage model profiles">Models ↗</button>
        </div>
        <div class="context-strip">
          <span id="contextCount">Ready for your question</span>
          <span id="estimate">Text estimate: —</span>
        </div>
        <div class="row">
          <button id="auto" aria-pressed="false">Auto: off</button>
          <button id="askAgain" hidden>Start again</button>
        </div>
        <div class="row">
          <button id="settings">Settings</button>
          <button id="openHistory">History</button>
        </div>
      </details>

      <p id="usageLine" class="usage-line">No tokens used in this answer yet.</p>
      <p class="note" id="privacy">
        Ask sends this question and selected images to your AI provider. AI suggestions can be wrong.
      </p>
    </section>
    <button id="launcher" class="launcher" aria-expanded="true">
      <span class="dot"></span><span id="launcherLabel">Umíme Helper</span>
    </button>`;
  document.documentElement.append(host);
  const $ = (id) => root.getElementById(id);
  let settings,
    observer,
    scanTimer,
    autoTimer,
    revision = 0,
    fingerprint = "",
    edited = false,
    busy = false;
  let pageData,
    paused = false,
    lastAttempt = "",
    lastClicked = "",
    configureId = 0;
  let layoutInitialized = false,
    lastReveal = false;
  let activeRequestId = null,
    retryAt = 0,
    attachments = [],
    imageErrors = [],
    imagesLoading = false,
    imageGeneration = 0;
  const cache = new Map();
  const message = async (data) => {
    try {
      const r = await chrome.runtime.sendMessage(data);
      if (r?.error)
        throw Object.assign(Error(r.error), {
          code: r.code,
          retryAfter: r.retryAfter,
        });
      return r;
    } catch (e) {
      if (
        /Extension context invalidated|Receiving end does not exist|message port closed/i.test(
          e.message,
        )
      )
        throw Object.assign(
          Error(
            "Extension updated or disconnected. Refresh this exercise page to reconnect.",
          ),
          { code: "disconnected" },
        );
      throw e;
    }
  };
  const keyOf = (data) =>
    JSON.stringify([
      data.question,
      data.choices,
      data.imageSignature || [],
      (data.images || []).map((im) => [im.hash, im.label]),
    ]);
  const input = () => ({
    question: $("question").value.trim(),
    choices: $("choices")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    images: $("includeImages").checked
      ? attachments.map(({ data, label, hash }) => ({ data, label, hash }))
      : [],
  });
  const visible = () => document.visibilityState !== "hidden";
  function syncActions() {
    $("setup").hidden = !settings || settings.configured;
    $("ask").hidden =
      (settings && !settings.configured) ||
      busy ||
      !$("result").hidden ||
      !$("recovery").hidden;
    $("askAgain").hidden = $("result").hidden;
  }
  function status(text, error = false) {
    $("status").textContent = text;
    $("status").dataset.error = String(error);
    $("recovery").hidden = !error;
    syncActions();
  }
  function cancelAuto() {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  function invalidate() {
    if (activeRequestId)
      message({ type: "cancelSolve", requestId: activeRequestId }).catch(
        () => {},
      );
    revision++;
    cancelAuto();
    $("result").hidden = true;
    $("launcherLabel").textContent = "Umíme Helper";
    syncActions();
  }
  function autoUI() {
    if (!busy)
      $("ask").textContent = settings?.hintFirst ? "Get a hint" : "Ask AI ↗";
    const enabled = Boolean(settings?.autoSolve);
    $("moreSummary").textContent =
      "More options" +
      (enabled ? (paused ? " · auto paused" : " · auto on") : "");
    $("auto").setAttribute("aria-pressed", String(enabled && !paused));
    $("auto").textContent =
      paused && enabled ? "Resume auto" : enabled ? "Pause auto" : "Auto: off";
    $("privacy").textContent = enabled
      ? `Auto sends each new text question to your AI provider.${settings.hintFirst ? " Hints are never auto-clicked." : settings.autoClick ? " Auto-click is enabled." : ""} API limits and charges may apply.`
      : "Sends this question and selected images to your provider." +
        (settings?.historyEnabled
          ? " Study text is saved locally in History."
          : " History is off.");
  }
  function schedule() {
    if (
      host.style.display === "none" ||
      !settings?.autoSolve ||
      paused ||
      busy ||
      edited ||
      !visible() ||
      !pageData?.question ||
      pageData.hasImages
    ) {
      cancelAuto();
      return;
    }
    if (!settings.configured) {
      status("Add an API key in Settings to use auto-answer.");
      return;
    }
    const key = keyOf(pageData);
    if (key === lastAttempt) {
      cancelAuto();
      return;
    }
    if (autoTimer) return;
    const stamp = revision;
    status("Auto-answer queued…");
    autoTimer = setTimeout(
      () => {
        autoTimer = null;
        if (stamp !== revision || !visible()) return;
        scan();
        if (stamp === revision) solve(true);
      },
      Math.max(500, Math.min(10000, Number(settings.autoDelay) || 1500)),
    );
  }
  function scan(force = false) {
    if (!settings) return;
    try {
      const data = Umime.extract(document, settings),
        fp = JSON.stringify(data);
      if (force || fp !== fingerprint) {
        fingerprint = fp;
        pageData = data;
        invalidate();
        lastClicked = "";
        if (!edited || force) {
          $("sourceSummary").textContent =
            "Review question · " + data.choices.length + " choices";
          $("question").value = data.question;
          $("choices").value = data.choices.join("\n");
          edited = false;
          refreshImages();
          updateEstimate();
          status(
            data.question
              ? `${data.choices.length} choices detected.${data.hasImages ? " Images detected. Review the attachments, then Ask." : " Ready to answer."}`
              : "No question detected. Use selection, paste text, or adjust selectors in Settings.",
          );
        } else
          status(
            "Page changed. Your edits are kept; Rescan loads the new question.",
          );
      }
      schedule();
    } catch {
      cancelAuto();
      status("Detection failed. Check CSS selectors in Settings.", true);
    }
  }
  function appearance() {
    const light =
      settings.theme === "light" ||
      (settings.theme === "auto" &&
        matchMedia("(prefers-color-scheme: light)").matches);
    const colors = light
      ? {
          "--error": "#a32f27",
          "--bg": "#f6f8fc",
          "--fg": "#172439",
          "--muted": "#52647d",
          "--field": "#ffffff",
          "--line": "#d5dfea",
        }
      : {
          "--error": "#ffb4a4",
          "--bg": "#0d1728",
          "--fg": "#eff5ff",
          "--muted": "#a4b4cd",
          "--field": "#152238",
          "--line": "#30425b",
        };
    for (const [k, v] of Object.entries(colors)) host.style.setProperty(k, v);
    const accent = /^#[0-9a-f]{6}$/i.test(settings.accent)
      ? settings.accent
      : "#a3e635";
    const channels = accent
      .slice(1)
      .match(/../g)
      .map((h) => parseInt(h, 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    const luminance =
      0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    host.style.setProperty("--accent", accent);
    host.style.setProperty(
      "--accent-ink",
      luminance > 0.179 ? "#000000" : "#ffffff",
    );
    const size = Math.max(12, Math.min(20, Number(settings.fontSize) || 14));
    host.style.fontSize = size + "px";
    host.style.setProperty("--font", size + "px");
    host.style.setProperty(
      "--panel-width",
      Math.max(320, Math.min(520, Number(settings.panelWidth) || 390)) + "px",
    );
    host.style.setProperty(
      "--answer-size",
      Math.max(22, Math.min(44, Number(settings.answerSize) || 30)) + "px",
    );
    host.style.colorScheme = light ? "light" : "dark";
    host.style.setProperty(
      "left",
      settings.position === "left" ? "18px" : "auto",
      "important",
    );
    host.style.setProperty(
      "right",
      settings.position === "left" ? "auto" : "18px",
      "important",
    );
    const select = $("profile");
    select.replaceChildren();
    for (const p of settings.profiles || []) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.name + " · " + (p.model || "Choose a model");
      select.append(option);
    }
    if (!select.options.length) {
      const option = document.createElement("option");
      option.textContent = "Add your first model";
      option.value = "";
      select.append(option);
    }
    select.value = [...select.options].some(
      (o) => o.value === settings.activeProfileId,
    )
      ? settings.activeProfileId
      : "";
    select.disabled = select.options.length < 2;
    $("panel").dataset.minimal = String(settings.minimalUI !== false);
    $("usageLine").hidden = !settings.showTokenDetails;
    autoUI();
  }
  async function configure(resetCache = false) {
    const id = ++configureId,
      next = (await message({ type: "settings" })).settings;
    if (id !== configureId) return;
    if (
      resetCache ||
      (settings && settings.solverIdentity !== next.solverIdentity)
    ) {
      cache.clear();
      lastAttempt = "";
      paused = false;
      invalidate();
    }
    if (settings?.autoSolve && !next.autoSolve && busy) {
      invalidate();
      status("Auto-answer turned off. Request stopped.");
    }
    const resizeChanged = settings && settings.imageSize !== next.imageSize;
    settings = next;
    appearance();
    syncActions();
    if (resizeChanged) refreshImages();
    observer?.disconnect();
    clearTimeout(scanTimer);
    if (settings.watch || settings.autoSolve) {
      observer = new MutationObserver((records) => {
        if (records.every((r) => r.target === host || host.contains(r.target)))
          return;
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => scan(), 350);
      });
      observer.observe(document.body || document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "aria-hidden",
          "disabled",
          "src",
          "srcset",
          "width",
          "height",
        ],
      });
    }
    if (!layoutInitialized) {
      layoutInitialized = true;
      if (settings.panelStart === "hidden") hideWidget();
      else if (settings.panelStart === "launcher") {
        $("panel").hidden = true;
        $("launcher").setAttribute("aria-expanded", "false");
      }
    }
    scan();
    if (!settings.configured) status("Connect a model to get started.");
  }
  function render(result, choices, cached = false, elapsed = 0) {
    $("answer").textContent = result.answer;
    $("explanation").textContent = result.explanation;
    $("matched").replaceChildren();
    for (const i of result.choiceIndexes) {
      const card = document.createElement("div"),
        number = document.createElement("b"),
        text = document.createElement("span");
      card.className = "choice";
      number.textContent = `CHOICE ${i + 1}`;
      text.textContent = choices[i];
      card.append(number, text);
      $("matched").append(card);
    }
    $("result").dataset.uncertain = String(result.uncertain);
    $("result").dataset.mode = result.mode || "answer";
    $("confidence").textContent =
      result.mode === "hint"
        ? "Hint"
        : result.uncertain
          ? "Uncertain · review context"
          : "Suggested answer";
    $("reveal").hidden = result.mode !== "hint";
    $("hintNote").hidden = result.mode !== "hint";
    $("reason").open = settings.showExplanation;
    $("result").hidden = false;
    $("source").open = false;
    $("answerMeta").textContent =
      (settings.modelLabel || "AI model") +
      " · " +
      (cached ? "session cache" : (elapsed / 1000).toFixed(1) + "s");
    $("copy").textContent =
      result.mode === "hint" ? "Copy hint" : "Copy answer";
    $("launcherLabel").textContent =
      result.mode === "hint" ? "Hint ready" : "Answer ready";
    $("result").setAttribute(
      "aria-label",
      result.mode === "hint" ? "Hint" : "Suggested answer",
    );
    const u = result.usage;
    $("usageLine").textContent = cached
      ? "Cache hit · no new API request or tokens."
      : u
        ? `${u.input.toLocaleString()} input + ${u.output.toLocaleString()} output = ${u.total.toLocaleString()} reported tokens${u.cached ? " · " + u.cached + " cached input" : ""}`
        : "Provider did not report token usage for this answer.";
    if (!cached)
      $("usageLine").textContent +=
        " · Cost estimate: " + Umime.costLabel(result.cost);
    if (result.historyWarning)
      $("usageLine").textContent += " · " + result.historyWarning;
    status(
      result.mode === "hint"
        ? cached
          ? "Hint reused from this page’s session."
          : "Hint ready."
        : cached
          ? "Answer reused from this page’s session."
          : "Answer ready.",
    );
  }
  function clickAnswer(result, request) {
    if (
      result.mode === "hint" ||
      !settings.autoClick ||
      result.uncertain ||
      result.choiceIndexes.length !== 1 ||
      edited ||
      !visible()
    )
      return;
    const current = Umime.extract(document, settings),
      key = keyOf(request);
    if (
      request.images?.length ||
      current.hasImages ||
      keyOf(current) !== key ||
      key === lastClicked
    )
      return;
    const matches = Umime.choiceTargets(document, settings).filter(
      (t) => t.text === request.choices[result.choiceIndexes[0]],
    );
    if (matches.length !== 1) {
      status("Answer ready. Auto-click skipped: no unique matching choice.");
      return;
    }
    const target = matches[0].element;
    if (
      target.closest('[disabled],[aria-disabled="true"],a') ||
      target.matches("input:not([type=radio]):not([type=checkbox])") ||
      target.getAttribute("aria-checked") === "true" ||
      target.checked
    ) {
      status(
        "Answer ready. Auto-click skipped: choice unavailable or already selected.",
      );
      return;
    }
    lastClicked = key;
    // Clicking may submit immediately on the site. Do it only after a fresh DOM comparison.
    target.click();
    status("Selected the suggested choice on the page.");
  }
  async function solve(automatic = false, reveal = false) {
    if (busy) return;
    lastReveal = reveal;
    if (Date.now() < retryAt) {
      status(
        "Provider cooldown: retry in " +
          Math.ceil((retryAt - Date.now()) / 1000) +
          " seconds.",
        true,
      );
      return;
    }
    cancelAuto();
    const request = input(),
      key = keyOf(request),
      mode = settings.hintFirst && !reveal ? "hint" : "answer",
      cacheKey = mode + ":" + key;
    if (imagesLoading) {
      status("Preparing your images. Please wait.");
      return;
    }
    if ($("includeImages").checked && imageErrors.length) {
      status(
        "Some images could not be attached. Upload replacements and choose Use these attachments, or turn Include images off.",
        true,
      );
      return;
    }
    if (!request.question && request.images.length)
      request.question = "Solve the question shown in the attached image.";
    if (!request.question) {
      status("Add a question or image first.");
      return;
    }
    if (
      automatic &&
      (attachments.length ||
        !settings.autoSolve ||
        paused ||
        edited ||
        !visible() ||
        pageData?.hasImages)
    )
      return;
    invalidate();
    activeRequestId = crypto.randomUUID();
    $("stop").hidden = false;
    const started = Date.now(),
      stamp = revision;
    lastAttempt = key;
    busy = true;
    $("panel").dataset.busy = "true";
    $("ask").disabled = true;
    $("ask").textContent = "Thinking…";
    status(mode === "hint" ? "Getting a hint…" : "Getting an answer…");
    try {
      const cached = cache.get(cacheKey),
        result =
          cached ||
          (
            await message({
              type: "solve",
              requestId: activeRequestId,
              mode,
              ...request,
            })
          ).result;
      // Re-read the page even when mutation watching is disabled.
      const samePage =
        edited ||
        keyOf(Umime.extract(document, settings)) ===
          keyOf(pageData || { question: "", choices: [] });
      if (stamp !== revision || keyOf(input()) !== key || !samePage) return;
      if (!cached) {
        cache.set(cacheKey, result);
        if (cache.size > 30) cache.delete(cache.keys().next().value);
      }
      render(result, request.choices, Boolean(cached), Date.now() - started);
      paused = false;
      autoUI();
      if (automatic && settings.autoSolve) clickAnswer(result, request);
    } catch (e) {
      if (e.retryAfter) retryAt = Date.now() + e.retryAfter * 1000;
      if (stamp === revision) {
        status(
          e.message +
            (automatic
              ? " Auto-answer paused; open More options to resume."
              : ""),
          true,
        );
        if (automatic) {
          paused = true;
          autoUI();
        }
      }
    } finally {
      activeRequestId = null;
      $("stop").hidden = true;
      busy = false;
      $("panel").dataset.busy = "false";
      $("ask").disabled = false;
      autoUI();
      syncActions();
      schedule();
    }
  }
  for (const id of ["question", "choices"])
    $(id).addEventListener("input", () => {
      edited = true;
      invalidate();
      updateEstimate();
      status(
        "Text edited. Press Ask when ready. Auto-answer waits for Rescan.",
      );
    });
  $("stop").onclick = () => {
    paused = true;
    invalidate();
    autoUI();
    status("Request stopped. Your provider may still count it.");
  };
  $("retry").onclick = () => solve(false, lastReveal);
  $("fixSettings").onclick = () =>
    message({ type: "openOptions" }).catch((e) => status(e.message, true));
  function updateEstimate() {
    $("questionPreview").textContent =
      $("question").value.trim() || "Add a question or image to begin.";
    const text = $("question").value + $("choices").value;
    $("estimate").textContent =
      "~" + Math.ceil(text.length / 3 + 180).toLocaleString() + " text tokens";
    $("contextCount").textContent =
      input().choices.length +
      " choices · " +
      ($("includeImages").checked ? attachments.length : 0) +
      " images";
  }
  function showImages() {
    $("attachmentCount").textContent = attachments.length
      ? "(" + attachments.length + ")"
      : "";
    if (attachments.length || imageErrors.length)
      $("attachmentArea").open = true;
    $("imageList").replaceChildren();
    attachments.forEach((im, i) => {
      const card = document.createElement("div"),
        img = document.createElement("img"),
        label = document.createElement("span"),
        remove = document.createElement("button");
      card.className = "image-card";
      img.src = im.data;
      img.alt = im.label;
      label.textContent = im.label + " · " + im.width + "×" + im.height;
      remove.textContent = "×";
      remove.setAttribute("aria-label", "Remove " + im.label);
      remove.onclick = () => {
        attachments.splice(i, 1);
        edited = true;
        invalidate();
        showImages();
      };
      card.append(img, label, remove);
      $("imageList").append(card);
    });
    $("imageStatus").textContent = imagesLoading
      ? "Preparing images locally…"
      : imageErrors.length
        ? imageErrors.join(" ")
        : attachments.length
          ? attachments.length +
            " images ready. Images use additional provider-dependent tokens."
          : "No attached images. Upload a picture or rescan the exercise.";
    $("confirmImages").hidden = !imageErrors.length;
    updateEstimate();
  }
  async function refreshImages() {
    const generation = ++imageGeneration;
    attachments = [];
    imageErrors = [];
    if (!Umime.imageTargets) {
      showImages();
      return;
    }
    const targets = Umime.imageTargets(document, settings);
    imagesLoading = targets.length > 0;
    showImages();
    const prepared = [],
      errors = [];
    if (targets.length > 4)
      errors.push("More than four images detected. Choose the relevant four.");
    for (const { node, label } of targets.slice(0, 4)) {
      try {
        prepared.push({
          ...(await Umime.captureImage(node, settings.imageSize)),
          label,
        });
      } catch (e) {
        errors.push(label + ": " + e.message);
      }
    }
    if (generation !== imageGeneration) return;
    attachments = prepared;
    imageErrors = errors;
    imagesLoading = false;
    showImages();
  }
  $("includeImages").onchange = () => {
    edited = true;
    invalidate();
    updateEstimate();
    status(
      $("includeImages").checked
        ? "Images will be included."
        : "Text-only mode. Attached images will not be sent.",
    );
  };
  $("uploadImage").onclick = () => $("imageFile").click();
  $("imageFile").onchange = async () => {
    const files = [...$("imageFile").files];
    $("imageFile").value = "";
    if (!files.length) return;
    if (files.length + attachments.length > 4) {
      status("Use up to four images. Remove an attachment first.", true);
      return;
    }
    const generation = ++imageGeneration;
    imagesLoading = true;
    edited = true;
    invalidate();
    showImages();
    try {
      const prepared = [];
      for (const file of files)
        prepared.push({
          ...(await Umime.uploadImage(file, settings.imageSize)),
          label: "Uploaded question image",
        });
      if (generation === imageGeneration) {
        attachments.push(...prepared);
        $("includeImages").checked = true;
      }
    } catch (e) {
      if (generation === imageGeneration) status(e.message, true);
    } finally {
      if (generation === imageGeneration) {
        imagesLoading = false;
        showImages();
      }
    }
  };
  $("confirmImages").onclick = () => {
    imageErrors = [];
    edited = true;
    invalidate();
    showImages();
    status(
      "Attachment selection confirmed. Check that all needed context is included.",
    );
  };
  $("setup").onclick = () =>
    message({ type: "openOptions" }).catch((e) => status(e.message, true));
  $("askAgain").onclick = () => {
    invalidate();
    status("Ready when you are.");
  };
  $("openHistory").onclick = () =>
    message({ type: "openHistory" }).catch((e) => status(e.message, true));
  $("reveal").onclick = () => solve(false, true);
  $("ask").onclick = () => solve(false);
  $("scan").onclick = () => scan(true);
  $("auto").onclick = async () => {
    try {
      if (paused && settings.autoSolve) {
        paused = false;
        lastAttempt = "";
        autoUI();
        schedule();
        return;
      }
      if (settings.autoSolve && busy) {
        paused = true;
        invalidate();
      }
      await message({ type: "setAutoSolve", enabled: !settings.autoSolve });
      await configure();
      status(
        settings.autoSolve
          ? "Auto-answer enabled. New questions are sent automatically."
          : "Auto-answer off.",
      );
      schedule();
    } catch (e) {
      status(e.message, true);
    }
  };
  let selectedText = "";
  document.addEventListener("selectionchange", () => {
    const text = getSelection()?.toString().trim();
    if (text) selectedText = text.slice(0, 10000);
  });
  $("selection").onclick = () => {
    if (!selectedText) {
      status("Select question text on the page first.");
      return;
    }
    imageGeneration++;
    imagesLoading = false;
    attachments = [];
    imageErrors = [];
    showImages();
    $("question").value = selectedText;
    $("choices").value = "";
    edited = true;
    invalidate();
    updateEstimate();
    status("Selection loaded. Add choices if needed, then Ask.");
  };
  $("copy").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("answer").textContent);
      $("copy").textContent = "Copied ✓";
    } catch {
      status(
        "Copy unavailable. Select and copy the answer text manually.",
        true,
      );
    }
  };
  function hideWidget() {
    paused = true;
    if (busy) invalidate();
    else cancelAuto();
    host.style.display = "none";
    autoUI();
  }
  $("hideAll").onclick = hideWidget;
  function toggle() {
    const wasHidden = host.style.display === "none";
    host.style.display = "";
    const open = wasHidden || $("panel").hidden;
    $("panel").hidden = !open;
    $("launcher").setAttribute("aria-expanded", String(open));
    if (open) $("ask").focus();
    else $("launcher").focus();
  }
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("panel").hidden) {
      e.stopPropagation();
      toggle();
    }
  });
  chrome.runtime.onMessage?.addListener((m, sender, respond) => {
    if (sender.id !== chrome.runtime.id || m.type !== "panelAction") return;
    if (m.action === "toggle") toggle();
    else if (m.action === "show") {
      host.style.display = "";
      $("panel").hidden = false;
      $("launcher").setAttribute("aria-expanded", "true");
      $("ask").focus();
    } else if (m.action === "hide") hideWidget();
    else if (m.action === "ask") {
      host.style.display = "";
      $("panel").hidden = false;
      $("launcher").setAttribute("aria-expanded", "true");
      solve(false);
    } else if (m.action === "scan") scan(true);
    else if (m.action === "stop") $("stop").click();
    else if (m.action === "clearCache") {
      cache.clear();
      invalidate();
      paused = true;
      autoUI();
      status("Session answers cleared. Auto-answer paused.");
    }
    respond({
      ready: true,
      busy,
      configured: Boolean(settings?.configured),
      choices: pageData?.choices.length || 0,
      hasQuestion: Boolean(pageData?.question),
      cached: cache.size,
      paused,
      hidden: host.style.display === "none",
    });
  });
  $("close").onclick = toggle;
  $("launcher").onclick = toggle;
  $("profile").onchange = async () => {
    try {
      invalidate();
      await message({ type: "setActiveProfile", id: $("profile").value });
      await configure(true);
    } catch (e) {
      status(e.message, true);
    }
  };
  $("manageModels").onclick = () =>
    message({ type: "openOptions" }).catch((e) => status(e.message, true));
  $("settings").onclick = () =>
    message({ type: "openOptions" }).catch((e) => status(e.message, true));
  const settingsPort = chrome.runtime.connect({ name: "umime-settings" });
  settingsPort.onMessage.addListener((update) => {
    if (update?.solverChanged) invalidate();
    configure(Boolean(update?.solverChanged)).catch((e) =>
      status(e.message, true),
    );
  });
  window.addEventListener("focus", () =>
    configure().catch((e) => status(e.message, true)),
  );
  document.addEventListener("visibilitychange", () => {
    cancelAuto();
    if (visible()) configure().catch((e) => status(e.message, true));
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener(
    "change",
    () => settings && appearance(),
  );
  configure().catch((e) => status(e.message, true));
})();
