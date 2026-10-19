Umime.visible = (el) =>
  !el.closest('[hidden], [aria-hidden="true"], nav, header, footer') &&
  el.getClientRects().length > 0 &&
  getComputedStyle(el).visibility !== "hidden";
Umime.elementText = function (el) {
  const clone = el.cloneNode(true),
    doc = el.ownerDocument;
  clone
    .querySelectorAll('script,style,[hidden],[aria-hidden="true"],.katex-html')
    .forEach((n) => n.remove());
  clone
    .querySelectorAll('annotation[encoding="application/x-tex"]')
    .forEach((n) =>
      n.replaceWith(doc.createTextNode(" " + n.textContent + " ")),
    );
  clone
    .querySelectorAll("img[alt]")
    .forEach((n) => n.replaceWith(doc.createTextNode(" " + n.alt + " ")));
  return this.clean(clone.textContent);
};
Umime.choiceTargets = function (doc, settings) {
  return [...doc.querySelectorAll(settings.choicesSelector)]
    .filter(this.visible)
    .map((element, i) => ({
      element,
      text:
        this.elementText(element) ||
        (element.matches("img,canvas,svg") ||
        element.querySelector("img,canvas,svg")
          ? `Choice ${i + 1} (image)`
          : ""),
    }))
    .filter((x) => x.text);
};
Umime.extract = function (doc, settings) {
  const candidates = [
    ...doc.querySelectorAll(settings.questionSelector),
  ].filter(this.visible);
  // When a custom selector matches a wrapper and its child, read the wrapper once.
  const questions = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el)),
  );
  const targets = this.choiceTargets(doc, settings);
  return {
    question: questions
      .map((el) => this.elementText(el))
      .filter(Boolean)
      .join("\n")
      .slice(0, 10000),
    choices: targets.map((x) => x.text).slice(0, 30),
    imageSignature: this.imageSignature
      ? this.imageSignature(doc, settings)
      : [],
    hasImages: this.imageTargets
      ? this.imageTargets(doc, settings).length > 0
      : [...questions, ...targets.map((t) => t.element)].some(
          (el) =>
            el.matches("img,canvas") ||
            el.querySelector("img,canvas,svg:not(.MathJax)"),
        ),
  };
};
