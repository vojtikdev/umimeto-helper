// Presets intentionally carry connection metadata only, never credentials or automation.
Umime.exportPresets = (profiles) => ({
  format: "umime-helper-presets",
  version: 1,
  profiles: profiles.map((p) => ({
    name: p.name,
    provider: p.provider,
    endpoint: p.endpoint,
    model: p.model,
    inputRate: p.inputRate ?? "",
    outputRate: p.outputRate ?? "",
    cachedRate: p.cachedRate ?? "",
    currency: p.currency || "USD",
    noKey: p.noKey === true,
    vision: p.vision === true,
    tokenField:
      p.tokenField ||
      (new URL(p.endpoint).hostname === "api.openai.com"
        ? "max_completion_tokens"
        : "max_tokens"),
  })),
});
Umime.importPresets = (text) => {
  if (typeof text !== "string" || text.length > 100000)
    throw Error("Choose a preset JSON file smaller than 100 KB.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(
      "This file is not valid JSON. Export a preset file from Umíme Helper.",
    );
  }
  if (
    data?.format !== "umime-helper-presets" ||
    data.version !== 1 ||
    !Array.isArray(data.profiles) ||
    !data.profiles.length ||
    data.profiles.length > 16
  )
    throw Error(
      "Expected a version 1 Umíme Helper preset file with 1–16 profiles.",
    );
  return data.profiles.map((p, i) => {
    if (
      !p ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 60 ||
      typeof p.endpoint !== "string" ||
      p.endpoint.length > 2048 ||
      typeof p.model !== "string" ||
      !p.model.trim() ||
      p.model.length > 200 ||
      typeof p.noKey !== "boolean"
    )
      throw Error(
        "Profile " +
          (i + 1) +
          " has invalid name, endpoint, model or authentication fields.",
      );
    for (const k of ["inputRate", "outputRate", "cachedRate"])
      if (
        p[k] != null &&
        p[k] !== "" &&
        ((typeof p[k] !== "string" && typeof p[k] !== "number") ||
          !Number.isFinite(Number(p[k])) ||
          Number(p[k]) < 0 ||
          Number(p[k]) > 1000000)
      )
        throw Error("Invalid price in preset.");
    if (p.currency && !["USD", "EUR", "CZK"].includes(p.currency))
      throw Error("Unsupported pricing currency.");
    const endpoint = Umime.endpoint(p.endpoint).href;
    return {
      id: crypto.randomUUID(),
      name: p.name.trim(),
      provider: Object.hasOwn(Umime.providers, p.provider)
        ? p.provider
        : "custom",
      endpoint,
      model: p.model.trim(),
      inputRate: p.inputRate ?? "",
      outputRate: p.outputRate ?? "",
      cachedRate: p.cachedRate ?? "",
      currency: p.currency || "USD",
      noKey: p.noKey,
      vision: p.vision === true,
      tokenField:
        p.tokenField === "max_completion_tokens"
          ? "max_completion_tokens"
          : "max_tokens",
      apiKey: "",
    };
  });
};
