// Bounded local study history, never images, credentials, or page URLs.
globalThis.History = {
  queue: Promise.resolve(),
  run(fn) {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  },
  prune(entries, s) {
    const days = [1, 7, 30].includes(Number(s.historyDays))
        ? Number(s.historyDays)
        : 7,
      limit = Math.max(10, Math.min(100, Number(s.historyLimit) || 50));
    return entries
      .filter((e) => e.time >= Date.now() - days * 86400000)
      .slice(0, limit);
  },
  add(data, s) {
    return this.run(async () => {
      // Re-read to honor opt-out or retention changes while a response was in flight.
      const current = await chrome.storage.local.get(Umime.defaults);
      if (!current.historyEnabled) return;
      const { historyEntries = [] } = await chrome.storage.local.get({
          historyEntries: [],
        }),
        r = data.result;
      const entry = {
        id: crypto.randomUUID(),
        time: Date.now(),
        question: data.question.slice(0, 3000),
        choices: data.choices.map((c) => c.slice(0, 300)),
        imageCount: data.imageCount,
        model: String(data.model || "").slice(0, 200),
        profile: String(data.profile || "").slice(0, 60),
        mode: r.mode,
        answer: r.answer.slice(0, 2000),
        explanation: r.explanation.slice(0, 2000),
        uncertain: r.uncertain,
        choiceIndexes: r.choiceIndexes,
        usage: r.usage,
        cost: r.cost,
      };
      await chrome.storage.local.set({
        historyEntries: this.prune([entry, ...historyEntries], current),
      });
    });
  },
  handle(message, s) {
    return this.run(async () => {
      const { historyEntries = [] } = await chrome.storage.local.get({
        historyEntries: [],
      });
      let entries = this.prune(historyEntries, s);
      if (message.type === "clearHistory") entries = [];
      if (message.type === "deleteHistory") {
        if (typeof message.id !== "string")
          throw Error("Choose a history entry.");
        entries = entries.filter((e) => e.id !== message.id);
      }
      await chrome.storage.local.set({ historyEntries: entries });
      return { entries };
    });
  },
};
