// Local aggregate counters only: no prompts, images, URLs or credentials.
globalThis.Meter = {
  queue: Promise.resolve(),
  pending: 0,

  day() {
    const date = new Date();
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  },

  blank() {
    return {
      requests: 0,
      input: 0,
      output: 0,
      cached: 0,
      reported: 0,
      unknown: 0,
      failed: 0,
      costs: {},
      unpriced: 0,
    };
  },

  serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  },

  parse(usage) {
    if (
      !usage ||
      !Number.isSafeInteger(usage.prompt_tokens) ||
      usage.prompt_tokens < 0 ||
      !Number.isSafeInteger(usage.completion_tokens) ||
      usage.completion_tokens < 0
    ) {
      return null;
    }

    const cached = usage.prompt_tokens_details?.cached_tokens;
    return {
      input: usage.prompt_tokens,
      output: usage.completion_tokens,
      cached:
        Number.isSafeInteger(cached) && cached >= 0
          ? Math.min(cached, usage.prompt_tokens)
          : 0,
      total: usage.prompt_tokens + usage.completion_tokens,
    };
  },

  reserve(settings) {
    return this.serial(async () => {
      const { usageLedger = {} } = await chrome.storage.local.get({
        usageLedger: {},
      });
      const day = this.day();
      const values = {
        ...this.blank(),
        ...usageLedger[day],
      };

      if (
        Number(settings.dailyRequestLimit) > 0 &&
        values.requests >= Number(settings.dailyRequestLimit)
      ) {
        throw failure(
          "budget",
          "Daily request limit reached. Review Usage & efficiency in Settings.",
        );
      }

      if (
        Number(settings.dailyTokenLimit) > 0 &&
        values.input + values.output >= Number(settings.dailyTokenLimit)
      ) {
        throw failure(
          "budget",
          "Reported token threshold reached. Review Usage & efficiency in Settings.",
        );
      }

      values.requests++;
      usageLedger[day] = values;
      const trimmed = Object.fromEntries(
        Object.entries(usageLedger)
          .sort(([first], [second]) => first.localeCompare(second))
          .slice(-14),
      );

      await chrome.storage.local.set({ usageLedger: trimmed });
      this.pending++;
      return day;
    });
  },

  finish(usage, failed, day = this.day(), cost = null) {
    return this.serial(async () => {
      const { usageLedger = {} } = await chrome.storage.local.get({
        usageLedger: {},
      });
      const values = {
        ...this.blank(),
        ...usageLedger[day],
      };

      if (usage) {
        values.input += usage.input;
        values.output += usage.output;
        values.cached += usage.cached;
        values.reported++;
      } else {
        values.unknown++;
      }

      if (cost) {
        values.costs = {
          ...values.costs,
          [cost.currency]: (values.costs?.[cost.currency] || 0) + cost.amount,
        };
      } else {
        values.unpriced = (values.unpriced || 0) + 1;
      }

      this.pending = Math.max(0, this.pending - 1);
      if (failed) values.failed++;
      usageLedger[day] = values;
      await chrome.storage.local.set({ usageLedger });
    });
  },

  read() {
    return this.serial(async () => {
      const { usageLedger = {} } = await chrome.storage.local.get({
        usageLedger: {},
      });
      return {
        day: this.day(),
        today: {
          ...this.blank(),
          ...usageLedger[this.day()],
        },
        days: usageLedger,
      };
    });
  },

  reset() {
    return this.serial(() => {
      if (this.pending) {
        throw Error(
          "Wait for running requests to finish before resetting usage.",
        );
      }
      return chrome.storage.local.set({ usageLedger: {} });
    });
  },
};
