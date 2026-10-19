# Umíme Helper 2.2

A lightweight Manifest V3 Chrome extension for macOS (Intel and Apple Silicon). Plain JavaScript, no build step or runtime dependencies. Independent project, not affiliated with Umíme to.

## Install or update

**New installation:** unzip into a permanent folder, open `chrome://extensions`, turn on Developer mode, click **Load unpacked**, and select the `umime-helper` folder containing `manifest.json`. Click the extension icon, then its Settings gear, then refresh an exercise tab.

**Update from any earlier version:** replace files inside the **same installed folder**, press Reload on the extension at `chrome://extensions`, and refresh exercise tabs. Keeping the same folder preserves your extension identity and settings. An existing single connection remains usable and appears as **My model**. Saving it or adding another model migrates it into the profile collection while retaining its key. Existing automation preferences are preserved; on a new install both automation options are off.

Keep the extracted folder in place. Chrome cannot load an unpacked extension directly from a ZIP. This is a development package, not a signed Web Store release. Safari is not supported.

## New in 2.2: one clear next step

- The page panel leads with a short preview of the question and one main action: Connect a model, Get a hint / Ask AI, Show answer, or Stop. Once a result is ready, the original Ask button is removed from the main view; Start again is available under More options.
- Review question contains editing, Refresh from page, and Use selected text. Images has its own disclosure and opens when attachments need review.
- More options contains model selection, automation, Settings and History. Its label shows when automatic mode is on or paused, so running automation is not silently hidden.
- The header keeps Minimize and a clearly labeled Hide action. Hide still pauses the tab and can be reversed through the toolbar or shortcut.
- The toolbar leads with Open helper. Quick actions, Today's usage, and Model & automation are collapsed by default. Stop remains visible while a request is running; History and Settings stay in the footer.
- Saved-model setup is collapsed in Settings. Add model and Edit profile open it when needed; first-time setup remains open.

Existing features and preferences remain available. These are layout and navigation changes, with no new permissions or runtime dependencies.

## Features retained from 2.1

The panel now starts as a small launcher. The main action is **Get a hint**; question editing and image controls are collapsed until needed. Settings use short labels, smaller headings and fewer decorative elements. Existing model, provider and appearance settings are retained.

### Hint first

Enabled by default under **Learning & automation**. Get a hint asks the model for guidance without the final answer or choice selection. **Show answer** makes a separate, explicit request for the solution and may consume additional tokens and quota. Hint and answer caches are separate. Hints never auto-click choices, even when automatic clicking is enabled. The model is instructed not to reveal the answer, but model output is not a guaranteed spoiler filter. Disable Hint first to return to direct answers. Connection tests still use direct answers.

### Local study history

History is enabled by default, retains up to 50 recent successful requests for 7 days, and can be disabled. Choose 1/7/30 days and 10/50/100 entries. Each entry contains question/choice text, hint or answer, explanation, model name, timestamp, image count, reported usage and a cost snapshot. No image bytes, API keys, endpoints, or page URLs are stored. Long text is truncated for storage: question 3,000 characters, each choice 300, answer/explanation 2,000 each. History may include a completed request whose result became stale on the page. Cache hits and setup connection tests do not add entries.

Search and expand entries under History; copy or delete individual entries, clear all entries with confirmation, or export JSON. Export contains saved study text and is not an importable model-preset file. History is local plaintext, not synced or sent to a provider as context. Retention is enforced when history is read or an entry is saved, not by a background timer. Turning saving off preserves existing entries; Clear history deletes them. Saving is rechecked when an in-flight request completes. History read/delete/export controls are restricted to extension pages.

### Cost estimates

Edit a model → **Cost estimate** and enter input/output/cached-input prices per one million tokens in USD, EUR or CZK. Blank prices mean unknown; explicit zero means free. A blank cached-input price uses the normal input rate. Rates are user-maintained and are not downloaded or verified against live provider prices.

Formula: `(uncached input × input rate + cached input × cached rate + output × output rate) / 1,000,000`. Cached input is a subset of input and is not counted twice. Estimates require reported usage and valid input/output rates. Unknown usage or unset pricing is shown as not estimated, never silently treated as free. No pre-request monetary estimate is shown because image/reasoning usage varies.

Today's estimates appear in Usage and the popup, grouped by currency with no conversion. Per-answer estimates are available when token details are enabled; history preserves each request's estimate. Totals retain the prices in effect when the request ran, include connection tests and metered malformed answers, and may omit cancelled or otherwise unreported requests. Taxes, fees, provider discounts and other charges are excluded. These estimates are not bills or spending caps.

### Hide and customize

- **−** minimizes the panel to its launcher; automatic mode can keep running.
- **× / Hide widget** removes both panel and launcher, stops pending work, and pauses automation in that tab. A ready answer is preserved. Use the toolbar's **Open panel** or **Option/Alt + Shift + U** to reopen it. Reopening does not silently resume paused automation.
- Under Appearance choose startup behavior: launcher, open panel, or completely hidden. Startup changes apply on new/reloaded exercise pages.
- Toggle Minimal interface, per-answer token/cost details, expanded explanations, theme, accent, position, panel width and text sizes. The global usage overview remains available even when per-answer details are hidden.

## Features retained from 2.0: vision and usage

The page panel, toolbar popup and settings have a new blue/teal visual system, clearer hierarchy, responsive layouts and light/dark themes. Existing appearance preferences are preserved. To try the new default accent and sizes, use Appearance → Reset preferences (this also resets automation/detection/efficiency preferences, but retains model profiles and keys).

### Send images with a question

1. Edit your profile in Models and enable **This model supports image input** for a model that actually accepts vision input. Model discovery and the text-only connection test do not verify vision capability.
2. Open an exercise. The panel reads visible images inside the configured question and choice elements, prepares them locally and shows attachment previews. Image-only choices receive numbered labels.
3. Review the question and images, then press **Ask AI**. Text and inline image bytes are sent together to your selected OpenAI-compatible API. No screenshot of the whole page is taken.
4. If an image is blocked by browser security or not detected, **Upload image** accepts PNG, JPEG or WebP files under 10 MB. When replacing blocked images, choose **Use these attachments** to acknowledge the selection. You can remove attachments or explicitly disable **Include images** for text-only requests.

Up to four images are sent per request. They are converted to JPEG on a white background at 85% quality, resized without cropping or upscaling to the chosen maximum edge (768 / 1280 / 1600 pixels), and limited to approximately 3 MB of compressed image bytes (4 million base64/data-URL characters total). Compression can lose fine detail: use 1600 px and Auto detail for small text. Arbitrary remote image URLs are never forwarded to providers. Attachments stay in page memory and are not saved in extension storage.

Visible img elements, readable canvas content and rasterizable inline SVG inside the configured exercise selectors are supported. Cross-origin/tainted canvases, complex or external-resource SVG, CSS background images, audio/video, and offscreen images may require a manual upload. Canvas pixel changes without DOM mutations need Rescan. Uploaded files are treated as question images; their filenames are not sent. Auto-answer and auto-click remain paused for visual questions so you can review their attachments.

### Understand and control tokens

**Usage & efficiency** shows today’s request attempts, provider-reported input/output tokens, cached input (a subset of input, not additional tokens), unknown-usage counts, and a table of the last 14 active days. The panel shows per-answer reported usage; cache hits show that no new API request was made. The popup summarizes today’s totals and cost estimates.

- **Text estimate:** a rough character-based estimate including an approximate prompt allowance. It is not a tokenizer or a context-limit guarantee and excludes image tokens. The actual provider total may differ substantially, especially with images or reasoning models.
- **Output cap:** 128–4,096 tokens, default 768. Choose max_tokens or max_completion_tokens per profile according to provider support. OpenAI endpoints default to max_completion_tokens. A truncated response produces a clear error instead of presenting partial JSON. Reasoning tokens may consume this cap.
- **Explanation style:** one concise sentence or up to four short steps. Only the current question, choices and attachments are sent; no full page or conversation history is included.
- **Image controls:** adjustable maximum edge and low/auto detail. Lower detail is not suitable for every diagram. Image token accounting and savings vary by provider/model.
- **Daily request cap:** defaults to 100 attempts across tabs, including connection tests and blocked/failed attempts after input validation. It is reserved before making a request so concurrent tabs share the cap. Set 0 for unlimited.
- **Reported-token threshold:** defaults to 50,000 per local calendar day; 0 disables it. Further requests stop once recorded input+output reaches the threshold. This is a soft guard, not a billing ceiling: unknown usage, cancelled requests and requests already in flight may exceed it.
- **Caching:** up to 30 answers per page session. Cache identity includes image hashes and changes to model, vision settings, output cap, explanation style and language. It does not retain image payloads in cache keys. Rescanning identical pictures can reuse the answer.

Usage counters are local aggregates and persist across Chrome restarts. They contain no questions, image bytes, API keys or URLs; cost totals use your configured prices. Study history is stored separately. Days follow the computer’s local date. Reset is a two-click action, resets local guards, and is blocked during running requests; it does not change provider billing. API/transport failures may have unknown usage, and malformed answers can still consume reported tokens. Changes in provider API behavior and local storage failures can make these counters differ from your provider’s billing dashboard.

### Upgrade notes

Existing connections remain available. New efficiency defaults apply to older installations; review them before resuming long automatic sessions. Enable vision separately on each relevant profile. Imported/exported presets include vision and output-cap parameter metadata but never keys. No new browser permissions are needed.

## Features retained from 1.3

- Toolbar dashboard: current exercise state, model selection, Ask, Rescan, Stop, show/hide panel, automation toggle and session-cache clearing.
- Stop cancels an in-flight browser request and pauses automation in that tab. Changing the question/model also cancels stale work. Providers may still process or bill requests already received.
- Structured errors for authentication, permissions, network failures, provider outages, invalid responses and rate limits. In-panel Retry and Check settings actions make recovery easier.
- Rate-limit cooldown honors Retry-After (1–3,600 seconds; 30-second fallback). It is held in service-worker memory and resets when the worker restarts. The panel also prevents early retries while it remains loaded. No silent paid retries.
- Only one solve request per tab/frame at a time. Wrong request IDs or other senders cannot cancel it.
- Portable model presets: export metadata without API keys, validate and review imports before saving, retain existing profiles. This is not a full settings/key backup. Import grants no host permissions; edit and Save & use to authorize a new host.
- Tools & help includes a local diagnostic report with no keys, endpoints, question text or browsing history. It does not contact your provider.
- Keyboard shortcut: **Option + Shift + U** on macOS, **Alt + Shift + U** elsewhere. Escape minimizes a focused panel. Configure conflicting shortcuts at `chrome://extensions/shortcuts`.
- New extension icons, unsaved-change reminders when leaving settings, and accessible toolbar loading/empty/error states.

The toolbar requires no new broad browser permissions. It communicates with the already-installed content script; refresh exercise tabs after every extension update. The dashboard is a controller, and answers appear in the page panel.

## Features retained from 1.2

- Up to 16 named model profiles, each with its own endpoint, model ID, and key.
- Switch models directly from the in-page panel. Old results are discarded during a switch.
- Presets for OpenAI, Gemini, Groq, OpenRouter, DeepSeek, Mistral, Ollama, and LM Studio, plus a custom provider option.
- Fetch available model IDs, or type any compatible model ID manually. Test a draft connection before saving it.
- Local HTTP servers on `localhost` and `127.0.0.1`, including keyless local inference.
- Redesigned settings with Models, Automation, Appearance, and Detection sections; saved model cards; clear save states; and a live appearance preview.
- An updated answer panel with a model picker, prominent answer, choice badges, collapsible context and explanation, copy action, model attribution, and response timing.
- Adjustable panel width in addition to theme, accent, text sizes, and side.

## Set up your models

1. Open **Settings → Models → Add model**.
2. Name the profile and choose a provider preset, or choose **Custom provider**.
3. Enter the API base URL (such as `https://provider.example/v1`) or full `/chat/completions` endpoint. Base URLs are expanded automatically.
4. Enter a key issued by that provider. For a server that does not require authentication, choose **No authentication · self-hosted**.
5. Click **Fetch available models** and use the model field to filter the results, or paste the exact model ID manually. Model lists may include image, embedding, and other non-chat models: choose a text/chat model.
6. Optionally click **Test connection**. It sends a small sample question and validates the response format; this may consume API quota or incur charges.
7. Click **Save & use model**. Chrome may ask for access to the API host. The profile becomes active.

Each profile saves its own key. Changing the provider preset clears the key in the editor to avoid sending the old provider's key to a different service. Save commits the edit. **Use model** activates a saved profile; **Edit profile** opens it for changes. **Remove profile** asks for a second click and deletes that profile and its stored key. Deleting the final profile disables automatic answers.

Profiles and preferences have separate save buttons. A successful connection test does not save the draft automatically. The live appearance preview also does not save preferences until you press **Save preferences**.

## Compatibility

This extension speaks the **OpenAI-compatible Chat Completions API**: POST a `model` and `messages` body, then read `choices[0].message.content`. It asks the model for a JSON answer. Providers/models that do not follow that format may fail; Test connection checks this before use.

You can choose model families available through compatible providers or gateways, including Claude through a gateway such as OpenRouter. **Native Anthropic Messages, Gemini-native GenerateContent, Azure-specific authentication, and other incompatible APIs are not directly supported.** Use their OpenAI-compatible routes where available. Web chatbot subscriptions or sign-ins are not API keys. Model access, prices, free tiers, and quota are controlled by the provider, not this extension.

**Local models:** start Ollama or LM Studio on your Mac and install/load a model first. Select the corresponding preset, then Fetch available models. Ollama defaults to `http://localhost:11434/v1`; LM Studio defaults to `http://localhost:1234/v1`. The extension does not install servers or download models. Local server tokens can be entered with API key authentication. Slow or cold models may exceed the 25-second timeout; load the model first or choose a faster one.

Custom remote endpoints must use HTTPS. HTTP is permitted only for `localhost` and `127.0.0.1`; arbitrary LAN HTTP and IPv6 loopback are not supported. URLs must not contain embedded credentials, query parameters, or fragments. Redirects are rejected. Model discovery uses the endpoint's sibling `/models` route. If that route is unavailable, enter the model ID manually.

## In-page workflow

Open a supported exercise. Review the question and possible choices in **Detected question**, then press **Ask AI**. Edit missing context directly in the panel; put each choice on its own line. **Use selection** imports the last page text selection and clears old choices. **Rescan** replaces edits with current detected text.

The answer card shows the suggested answer, numbered matching choices, an optional explanation, the selected model, and response timing. **Copy answer** copies its main text. Minimize with **−** and reopen with the launcher, which says **Answer ready** after a result. The model picker switches among saved profiles without opening Settings.

AI answers can be wrong. Text multiple-choice exercises work best. Complex mathematical layouts can lose formatting. Images and readable diagrams can be attached as described above. Audio and drag-and-drop exercises still need manual context. Image alt text may supplement captured pixels; no whole-page screenshot or audio is sent. Cross-origin iframes are not scanned.

## Automatic answers

**Auto: off / Pause auto** toggles automatic generation. A new text question waits for the configured settling delay, then is sent to the active provider in a visible tab. Repeated questions reuse a bounded cache of up to 30 answers held only in page memory. Reloading or changing the active provider/model/language clears it. Manual edits pause automatic requests for that text until Rescan. API errors pause automation; **Resume auto** explicitly retries.

In Settings → Automation, **Click the suggested choice** additionally clicks one unique visible choice when the model reports no uncertainty. This may submit immediately and affect your score. Disabled/duplicate choices, multiple suggested choices, edited questions, image context, and hidden tabs are skipped. It does not fill written answers or press Next. A fresh DOM comparison prevents a response for an old question from clicking a new question.

Automatic answers consume provider quota and may incur charges. Settings show this behavior explicitly. Automatic answering also enables question watching, even if standalone detection is off.

## Privacy and permissions

Keys and profiles are saved locally in this Chrome profile, without encryption and without Chrome Sync. Keys are restricted to trusted extension contexts. Neither page scripts nor the content script receive stored keys. Model output is rendered as plain text, not executable HTML.

The extension sends the question, choices and selected images when Ask AI is clicked. Automatic mode sends text questions and choices only. Fetch models and Test connection send explicit setup requests. No page URL, cookies, whole-page capture, telemetry, or saved answer history is sent to the model. Optional history is stored locally as described above. Your selected provider receives submitted text/images and handles it under its own policies. A chosen endpoint receives only its profile's Bearer key unless authentication is disabled.

Content scripts run on umimeto.org and the Czech, math, English, computing, facts, and German subject domains. The default OpenAI API host is declared; other HTTPS hosts and local HTTP hosts require optional host access on setup. Local host permission covers its ports, while requests use the configured port. Remove an unused permission through Chrome's extension controls if desired.

## Troubleshooting

**No panel:** reload the extension, refresh the exercise, and check the domain is supported.

**Missing/wrong question:** use selection, paste text, or adjust the two CSS selectors in Detection. Hidden content and common navigation containers are excluded.

**No models listed:** check the key, endpoint, provider's `/models` support, and local server/model status. Manual model IDs still work.

**401/403:** check the profile's key and model access. **404:** check the API base URL and exact model ID. **429:** check quota/billing or retry later. Network errors can mean the local server is stopped, host access was denied, or the connection is blocked. Requests time out after 25 seconds and are not automatically retried.

**Format error:** choose a model that reliably follows a JSON-output prompt. A reasoning-only, image, embedding, or incompatible API model may not work.

## Development and verification

No runtime build is required. For tests, use Node 24: `npm install`, then `npm test`. Tests use jsdom and mocked extension/provider APIs; no paid requests are made. Optional browser checks: `npx playwright install chromium`, then `RUN_BROWSER_TESTS=1 npm test`. The test fixture opens the shadow root only during testing.

Tests also cover hint/reveal separation, hiding and restoring the widget, local history access/retention/deletion, safe history rendering and cached-input cost accounting, plus vision gating, inline multimodal payloads, local resizing, image-only choices, reported/unknown token accounting, token truncation and cross-tab request budgets. Tests cover cancellation and request ownership, rate-limit cooldowns, structured failures, key-free preset validation, toolbar connected/unavailable states, local diagnostics, credential isolation, connection routing, localhost without a key, model discovery authorization, draft tests, legacy migration, profile switching, UI navigation and preview, preferences, deletion, extraction, automation, cache reuse, ambiguous clicks, hidden tabs, and stale responses.

The real-browser test remains skipped by default because the available browser runtime failed to launch in the build environment. Live provider calls, local inference servers, and installation on physical macOS hardware remain unverified. See `tests/results.txt` for the automated run.

References: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai), [Groq compatibility](https://console.groq.com/docs/openai), [OpenRouter](https://openrouter.ai/developers), [Ollama](https://docs.ollama.com/api/openai-compatibility), [LM Studio](https://lmstudio.ai/docs/developer/openai-compat).

## Chrome API references

- Commands and shortcut rules: https://developer.chrome.com/docs/extensions/reference/api/commands
- Tab messaging and active-tab queries: https://developer.chrome.com/docs/extensions/reference/api/tabs

Vision/API format references:
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- https://ai.google.dev/gemini-api/docs/openai
