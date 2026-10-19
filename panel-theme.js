Umime.panelCSS = `
:host {
  --accent: #8b7cff;
  --accent-ink: #ffffff;
  --bg: #10111a;
  --fg: #f7f7fb;
  --muted: #a8aabd;
  --line: #2b2d3d;
  --field: #191b29;
  --font: 14px;
  --answer-size: 32px;
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
  font: var(--font)/1.5 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--field);
  color: var(--fg);
  cursor: pointer;
  padding: 10px 13px;
  transition: border-color .15s, background .15s, transform .15s;
}

button:hover {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--line));
  background: color-mix(in srgb, var(--accent) 12%, var(--field));
  transform: translateY(-1px);
}

button:disabled {
  cursor: wait;
  opacity: .45;
}

button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

.panel {
  width: min(var(--panel-width, 420px), calc(100vw - 32px));
  max-height: calc(100dvh - 64px);
  overflow: auto;
  overscroll-behavior: contain;
  padding: 20px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background:
    radial-gradient(circle at 100% 0, color-mix(in srgb, var(--accent) 13%, transparent), transparent 34%),
    var(--bg);
  box-shadow: 0 24px 80px #05050b99;
  scrollbar-color: var(--line) transparent;
}

.panel-kicker {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 1.5px;
}

.panel-kicker span {
  color: var(--accent);
}

.bar,
.row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.bar strong {
  flex: 1;
  font-size: 18px;
  letter-spacing: -.5px;
}

.bar button {
  padding: 6px 9px;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.brand {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 11px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 23px;
  font-weight: 900;
}

.question-preview {
  display: -webkit-box;
  overflow: hidden;
  margin: 18px 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.result {
  padding: 20px;
  margin: 16px 0;
  border: 1px solid var(--line);
  border-top: 3px solid var(--accent);
  border-radius: 16px;
  background: var(--field);
}

.result[data-uncertain='true'] {
  border-top-color: #edbd67;
}

.eyebrow {
  margin-bottom: 12px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1px;
  text-transform: uppercase;
}

#answer {
  color: var(--fg);
  font-size: var(--answer-size);
  font-weight: 750;
  line-height: 1.2;
  letter-spacing: -1px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

#matched {
  display: grid;
  gap: 8px;
  margin-top: 18px;
}

.choice {
  display: flex;
  align-items: baseline;
  gap: 11px;
  padding: 11px 12px;
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 11%, var(--bg));
  overflow-wrap: anywhere;
}

.choice b {
  color: var(--muted);
  font-size: 10px;
  letter-spacing: .5px;
  white-space: nowrap;
}

.choice span {
  min-width: 0;
  font-weight: 650;
}

.explanation {
  padding-top: 14px;
  margin-top: 18px;
  border-top: 1px solid var(--line);
}

#explanation {
  color: var(--muted);
  line-height: 1.7;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.result-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
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

.row {
  flex-wrap: wrap;
  margin-top: 10px;
}

.row button {
  flex: 1;
  min-width: 0;
  font-size: 12px;
}

.ask {
  min-height: 44px;
  border-color: transparent;
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 800;
}

.ask:hover {
  border-color: transparent;
  background: var(--accent);
  filter: brightness(1.08);
}

#status {
  min-height: 24px;
  padding: 14px 0 4px;
  color: var(--muted);
  font-size: 11px;
  white-space: pre-wrap;
}

#status[data-error='true'] {
  color: #ffb4a4;
}

label {
  display: block;
  margin: 14px 0 6px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .7px;
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
  padding: 11px;
  resize: vertical;
  line-height: 1.6;
}

details {
  padding: 13px 0 0;
  margin-top: 13px;
  border-top: 1px solid var(--line);
}

summary {
  padding: 3px 0;
  color: var(--fg);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

details[open] > summary {
  margin-bottom: 12px;
}

#source,
.attachments {
  border-top-color: var(--line);
}

.connection {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--field);
}

.model-field {
  min-width: 0;
  flex: 1;
}

.model-field label {
  margin: 0 0 3px;
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
  font-size: 10px;
}

.context-strip {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin: 12px 0;
  color: var(--muted);
  font-size: 10px;
}

.attachment-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.inline {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 11px;
  letter-spacing: 0;
}

.inline input {
  accent-color: var(--accent);
}

#imageList {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.image-card {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--field);
}

.image-card img {
  display: block;
  width: 100%;
  height: 90px;
  object-fit: contain;
  background: white;
}

.image-card span {
  display: block;
  padding: 7px;
  color: var(--muted);
  font-size: 9px;
}

.image-card button {
  position: absolute;
  top: 4px;
  right: 4px;
  padding: 1px 7px;
  font-size: 18px;
}

.usage-line {
  padding: 11px;
  margin: 17px 0 0;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.launcher {
  display: block;
  padding: 11px 16px;
  margin-left: auto;
  border-radius: 13px;
  background: var(--bg);
  box-shadow: 0 8px 30px #0004;
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

#panel[data-busy='true'] #status::before {
  display: inline-block;
  margin-right: 7px;
  color: var(--accent);
  content: '◌';
  animation: spin 1s linear infinite;
}

.row:not(:has(button:not([hidden]))) {
  display: none;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
`;
