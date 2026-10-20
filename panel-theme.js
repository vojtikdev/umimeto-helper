
Umime.panelCSS = `
:host {
  --accent: #b8d5ae;
  --accent-ink: #14251b;
  --bg: #141d19;
  --fg: #f0f3ed;
  --muted: #a6b6aa;
  --line: #34463b;
  --field: #1d2923;
  --font: 13px;
  --answer-size: 28px;
}

* {
  box-sizing: border-box;
}

[hidden] {
  display: none !important;
}

.panel,
.launcher {
  color: var(--fg);
  font: var(--font)/1.55 system-ui, -apple-system, sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  padding: 10px 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  color: var(--fg);
  cursor: pointer;
  transition: border-color .15s, background .15s;
}

button:hover:not(:disabled) {
  border-color: var(--accent);
}

button:disabled {
  opacity: .45;
  cursor: wait;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* Panel */

.panel {
  width: min(var(--panel-width, 410px), calc(100vw - 24px));
  max-height: calc(100dvh - 40px);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 21px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--bg);
  box-shadow: 0 14px 48px #0004;
  scrollbar-color: var(--line) transparent;
}

.panel-kicker {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 17px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .3px;
}

.panel-kicker span {
  color: var(--accent);
}

/* Header */

.bar,
.row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.bar strong {
  flex: 1;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -.4px;
}

.bar button {
  padding: 6px 9px;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.bar button:hover {
  color: var(--fg);
}

.brand {
  display: grid;
  place-items: center;
  flex: none;
  width: 35px;
  height: 35px;
  border-radius: 11px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 22px;
  font-weight: 800;
}

/* Question */

.question-preview {
  display: -webkit-box;
  overflow: hidden;
  margin: 18px 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

/* Result */

.result {
  padding: 19px;
  margin: 15px 0;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--field);
}

.result[data-uncertain="true"] {
  border-color: #bfa36c;
}

.eyebrow {
  margin-bottom: 11px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .5px;
  text-transform: uppercase;
}

#answer {
  color: var(--fg);
  font-size: var(--answer-size);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -.8px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

#matched {
  display: grid;
  gap: 8px;
  margin-top: 17px;
}

.choice {
  display: flex;
  align-items: baseline;
  gap: 11px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--bg);
  overflow-wrap: anywhere;
}

.choice b {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.choice span {
  min-width: 0;
  font-weight: 600;
}

/* Explanation */

.explanation {
  padding-top: 15px;
  margin-top: 17px;
  border-top: 1px solid var(--line);
}

#explanation {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.result-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 17px;
}

#answerMeta,
.note,
.usage-line {
  color: var(--muted);
  font-size: 11px;
}

#answerMeta {
  overflow-wrap: anywhere;
}

.copy {
  padding: 7px 10px;
  font-size: 11px;
  white-space: nowrap;
}

/* Actions */

.row {
  flex-wrap: wrap;
  margin-top: 11px;
}

.row button {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.ask {
  min-height: 43px;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 750;
}

.ask:hover:not(:disabled) {
  border-color: var(--accent);
  filter: brightness(.95);
}

.row:not(:has(button:not([hidden]))) {
  display: none;
}

/* Status */

#status {
  min-height: 22px;
  padding: 13px 0 3px;
  color: var(--muted);
  font-size: 11px;
  white-space: pre-wrap;
}

#status[data-error="true"] {
  color: #f0aa9a;
}

#panel[data-busy="true"] #status::before {
  display: inline-block;
  margin-right: 7px;
  color: var(--accent);
  content: "◌";
  animation: spin 1s linear infinite;
}

/* Inputs */

label {
  display: block;
  margin: 13px 0 7px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
}

textarea,
.model-field select {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  color: var(--fg);
}

textarea {
  padding: 12px;
  resize: vertical;
  line-height: 1.6;
}

/* Expandable Sections */

details {
  padding: 14px 0 0;
  margin-top: 14px;
  border-top: 1px solid var(--line);
}

summary {
  padding: 3px 0;
  color: var(--fg);
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}

details[open] > summary {
  margin-bottom: 13px;
}

#source,
.attachments {
  border-top-color: var(--line);
}

/* Model Selection */

.connection {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: var(--field);
}

.model-field {
  min-width: 0;
  flex: 1;
}

.model-field label {
  margin: 0 0 4px;
}

.model-field select {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 12px;
  text-overflow: ellipsis;
}

#manageModels {
  padding: 7px;
  border: 0;
  color: var(--muted);
  font-size: 11px;
}

/* Context */

.context-strip {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 13px 0;
  color: var(--muted);
  font-size: 11px;
}

/* Attachments */

.attachment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.inline {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 11px;
}

.inline input {
  accent-color: var(--accent);
}

#imageList {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  margin-top: 11px;
}

.image-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
}

.image-card img {
  display: block;
  width: 100%;
  height: 90px;
  object-fit: contain;
  background: #fff;
}

.image-card span {
  display: block;
  padding: 8px;
  color: var(--muted);
  font-size: 10px;
  overflow-wrap: anywhere;
}

.image-card button {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 1px 7px;
  font-size: 17px;
}

/* Usage */

.usage-line {
  padding: 12px 0 0;
  margin-top: 17px;
  border-top: 1px solid var(--line);
}

/* Launcher */

.launcher {
  display: block;
  padding: 11px 16px;
  margin-left: auto;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--bg);
  box-shadow: 0 6px 22px #0003;
  font-size: 12px;
  font-weight: 700;
}

.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--accent);
}

/* Animation */

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
`;
