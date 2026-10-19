/* Shared connection validation. No runtime dependencies or remote executable code. */
globalThis.Umime = {
  defaults: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4.1-mini",
    apiKey: "",
    profiles: null,
    activeProfileId: "",
    theme: "auto",
    accent: "#43c6b5",
    position: "right",
    fontSize: 14,
    language: "Czech",
    watch: true,
    autoSolve: false,
    autoClick: false,
    autoDelay: 1500,
    outputLimit: 768,
    answerStyle: "concise",
    imageSize: 1280,
    imageDetail: "auto",
    dailyRequestLimit: 100,
    dailyTokenLimit: 50000,
    hintFirst: true,
    historyEnabled: true,
    historyDays: 7,
    historyLimit: 50,
    panelStart: "launcher",
    minimalUI: true,
    showTokenDetails: false,
    answerSize: 30,
    panelWidth: 380,
    showExplanation: false,
    questionSelector:
      '.question-content, [data-data="question"], .question .fmt-stem, #question, .assignment',
    choicesSelector:
      '[data-data="option"], .options .card, .answers .answer, [role="radio"]',
  },
  providers: {
    custom: {
      name: "Custom provider",
      base: "",
      model: "",
      hint: "Use an OpenAI-compatible Chat Completions API. Paste its API base URL or full /chat/completions endpoint.",
    },
    openai: {
      name: "OpenAI",
      base: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      hint: "Use an OpenAI API key. API billing is separate from a ChatGPT subscription.",
    },
    gemini: {
      name: "Google Gemini",
      base: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "",
      hint: "Use a Google AI Studio API key. Fetch models or paste the exact Gemini model ID available to your account.",
    },
    groq: {
      name: "Groq",
      base: "https://api.groq.com/openai/v1",
      model: "",
      hint: "Use a Groq API key, then fetch the models available to your account.",
    },
    openrouter: {
      name: "OpenRouter",
      base: "https://openrouter.ai/api/v1",
      model: "",
      hint: "One connection for many model families, including Claude, Gemini and open models. Select a chat model your account can access.",
    },
    deepseek: {
      name: "DeepSeek",
      base: "https://api.deepseek.com",
      model: "",
      hint: "Use a DeepSeek API key and an available chat model ID.",
    },
    mistral: {
      name: "Mistral",
      base: "https://api.mistral.ai/v1",
      model: "",
      hint: "Use a Mistral API key, then fetch available models.",
    },
    ollama: {
      name: "Ollama · local",
      base: "http://localhost:11434/v1",
      model: "",
      noKey: true,
      hint: "Start Ollama on this Mac and download a model first. Fetch models lists locally installed models; the extension does not download them.",
    },
    lmstudio: {
      name: "LM Studio · local",
      base: "http://localhost:1234/v1",
      model: "",
      noKey: true,
      hint: "Start LM Studio’s local server and load a model. If your server requires a token, select API key authentication.",
    },
  },
  sites: [
    "umimeto.org",
    "umimecesky.cz",
    "umimematiku.cz",
    "umimeanglicky.cz",
    "umimeinformatiku.cz",
    "umimefakta.cz",
    "umimenemecky.cz",
  ],
  clean: (text) =>
    String(text || "")
      .replace(/\s+/g, " ")
      .trim(),
  connection(s) {
    return (
      (Array.isArray(s.profiles) ? s.profiles : []).find(
        (p) => p.id === s.activeProfileId,
      ) ||
      (Array.isArray(s.profiles) ? s.profiles[0] : null) || {
        id: "legacy",
        name: "My model",
        provider: "custom",
        endpoint: s.endpoint,
        model: s.model,
        apiKey: s.apiKey,
        noKey: false,
      }
    );
  },
  connections(s) {
    return Array.isArray(s.profiles)
      ? s.profiles
      : s.apiKey
        ? [this.connection(s)]
        : [];
  },
  endpoint(value) {
    let u;
    try {
      u = new URL(String(value || "").trim());
    } catch {
      throw Error(
        "Enter a valid API URL, including https:// or http://localhost.",
      );
    }
    const local = ["localhost", "127.0.0.1"].includes(u.hostname);
    if (
      (u.protocol !== "https:" && !(u.protocol === "http:" && local)) ||
      u.username ||
      u.password ||
      u.search ||
      u.hash
    )
      throw Error(
        "Use HTTPS, or HTTP on localhost / 127.0.0.1, without embedded credentials or a query.",
      );
    u.pathname = u.pathname.replace(/\/+$/, "");
    if (!u.pathname.endsWith("/chat/completions"))
      u.pathname += "/chat/completions";
    return u;
  },
  origin(url) {
    return `${url.protocol}//${url.hostname}/*`;
  },
  validateConnection(p, requireModel = true) {
    if (!p || typeof p !== "object")
      throw Error("Choose a model profile first.");
    const url = this.endpoint(p.endpoint);
    if (
      requireModel &&
      (typeof p.model !== "string" || !p.model.trim() || p.model.length > 200)
    )
      throw Error("Choose a model or enter its exact model ID.");
    if (p.noKey !== true && !String(p.apiKey || "").trim())
      throw Error("Add your API key in Settings first.");
    return {
      ...p,
      endpoint: url.href,
      model: String(p.model || "").trim(),
      apiKey: String(p.apiKey || "").trim(),
      noKey: p.noKey === true,
    };
  },
  publicSettings(s) {
    const {
        apiKey,
        endpoint,
        model,
        profiles,
        activeProfileId,
        usageLedger,
        historyEntries,
        ...safe
      } = s,
      active = this.connection(s);
    return {
      ...safe,
      configured: Boolean(
        active.model && (active.apiKey || active.noKey === true),
      ),
      activeProfileId: active.id,
      modelLabel: active.model,
      profileName: active.name,
      supportsImages: active.vision === true,
      profiles: this.connections(s).map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
      })),
      solverIdentity: JSON.stringify([
        active.id,
        active.endpoint,
        active.model,
        active.vision,
        active.tokenField,
        s.language,
        s.answerStyle,
        s.outputLimit,
        s.imageDetail,
        s.imageSize,
        s.hintFirst,
      ]),
    };
  },
  isSite(url) {
    try {
      const u = new URL(url);
      return (
        u.protocol === "https:" &&
        this.sites.some((h) => u.hostname === h || u.hostname.endsWith("." + h))
      );
    } catch {
      return false;
    }
  },
};

Umime.cost = function (usage, profile) {
  if (
    !usage ||
    profile.inputRate == null ||
    profile.outputRate == null ||
    profile.inputRate === "" ||
    profile.outputRate === ""
  )
    return null;
  const input = Number(profile.inputRate),
    output = Number(profile.outputRate),
    cached =
      profile.cachedRate == null || profile.cachedRate === ""
        ? input
        : Number(profile.cachedRate),
    currency = profile.currency || "USD";
  if (
    ![input, output, cached].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 1000000,
    ) ||
    !["USD", "EUR", "CZK"].includes(currency)
  )
    return null;
  return {
    amount:
      ((usage.input - usage.cached) * input +
        usage.cached * cached +
        usage.output * output) /
      1000000,
    currency,
  };
};
Umime.costLabel = (cost) =>
  cost ? cost.amount.toFixed(6) + " " + cost.currency : "Not estimated";
