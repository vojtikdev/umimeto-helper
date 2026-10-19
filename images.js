/* Read only exercise-scoped visuals. Nothing is uploaded until Ask is pressed. */
Umime.imageTargets = function (doc, settings) {
  const roots = [...doc.querySelectorAll(settings.questionSelector)]
    .filter(this.visible)
    .map((el) => ({ el, label: "Question image" }));
  this.choiceTargets(doc, settings)
    .slice(0, 30)
    .forEach((t, i) =>
      roots.push({ el: t.element, label: `Choice ${i + 1} image` }),
    );
  const seen = new Set(),
    out = [];
  for (const { el, label } of roots)
    for (const node of [el, ...el.querySelectorAll("img,canvas,svg")]) {
      if (
        !node.matches("img,canvas,svg") ||
        seen.has(node) ||
        !this.visible(node) ||
        node.closest(".MathJax, mjx-container") ||
        node.parentElement?.closest("svg")
      )
        continue;
      seen.add(node);
      out.push({ node, label });
    }
  return out;
};
Umime.imageSignature = function (doc, settings) {
  return this.imageTargets(doc, settings).map(({ node, label }) => [
    label,
    node.tagName,
    node.currentSrc || node.src || "",
    node.width?.baseVal?.value || node.width || "",
    node.height?.baseVal?.value || node.height || "",
    node.tagName.toLowerCase() === "svg" ? node.outerHTML.slice(0, 100000) : "",
  ]);
};
Umime.resizeImage = async function (source, maxEdge = 1280) {
  const width =
      source.naturalWidth || source.width?.baseVal?.value || source.width,
    height =
      source.naturalHeight || source.height?.baseVal?.value || source.height;
  if (!width || !height)
    throw Error("Image has not loaded yet. Rescan when it is visible.");
  const scale = Math.min(
    1,
    Math.max(512, Math.min(1600, Number(maxEdge) || 1280)) /
      Math.max(width, height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw Error("Image processing is unavailable in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const data = canvas.toDataURL("image/jpeg", 0.85);
  if (data.length > 1800000)
    throw Error(
      "Image is too large after resizing. Choose a smaller image size in Settings.",
    );
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  const hash = Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  return { data, hash, width: canvas.width, height: canvas.height };
};
Umime.loadImage = async function (url) {
  return new Promise((resolve, reject) => {
    const image = new Image(),
      timer = setTimeout(() => {
        image.src = "";
        reject(Error("Image load timed out. Try uploading it."));
      }, 8000);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(
        Error("Could not read this image. Upload a PNG, JPEG or WebP copy."),
      );
    };
    image.src = url;
  });
};
Umime.captureImage = async function (node, maxEdge) {
  if (node.tagName.toLowerCase() === "svg") {
    if (node.outerHTML.length > 1000000)
      throw Error("Diagram is too complex. Upload a screenshot of it.");
    const clone = node.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const box = node.getBoundingClientRect();
    clone.setAttribute("width", Math.max(1, box.width));
    clone.setAttribute("height", Math.max(1, box.height));
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], {
        type: "image/svg+xml",
      }),
    );
    try {
      return this.resizeImage(await this.loadImage(url), maxEdge);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  try {
    if (node.tagName.toLowerCase() === "img" && !node.complete) {
      let timer;
      try {
        await Promise.race([
          node.decode(),
          new Promise(
            (_, reject) =>
              (timer = setTimeout(
                () => reject(Error("Image loading timed out.")),
                8000,
              )),
          ),
        ]);
      } finally {
        clearTimeout(timer);
      }
    }
    return await this.resizeImage(node, maxEdge);
  } catch {
    throw Error(
      "Browser security or image loading blocked this picture. Upload a copy, then confirm the attachments.",
    );
  }
};
Umime.uploadImage = async function (file, maxEdge) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 10000000
  )
    throw Error("Choose PNG, JPEG or WebP files under 10 MB each.");
  const url = URL.createObjectURL(file);
  try {
    return this.resizeImage(await this.loadImage(url), maxEdge);
  } finally {
    URL.revokeObjectURL(url);
  }
};
