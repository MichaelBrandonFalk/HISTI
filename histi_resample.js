(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.HISTI_RESAMPLE = factory(root.pica);
})(typeof globalThis !== "undefined" ? globalThis : this, function (createPica, createCanvas) {
  "use strict";
  let resizer;
  const makeCanvas = createCanvas || (() => document.createElement("canvas"));

  async function upscale(image, canvas) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const square = canvas.width === 3000 && canvas.height === 3000;
    if (width !== 1920 || height !== 1080 || (!square && (canvas.width !== 3840 || canvas.height !== 2160))) {
      throw new Error("Lanczos upscale requires 1920x1080 input and 3840x2160 or 3000x3000 output.");
    }
    if (typeof createPica !== "function") throw new Error("The bundled Lanczos resampler could not be loaded.");
    // Native browser scaling does not guarantee a Lanczos kernel.
    if (!resizer) resizer = createPica({ features: ["js", "wasm", "ww"], concurrency: 2 });
    const options = { filter: "lanczos3", unsharpAmount: 0 };
    if (!square) return resizer.resize(image, canvas, options);

    const scaled = makeCanvas();
    scaled.height = 3000;
    // Even raster width gives a symmetric integer-pixel crop with no second interpolation.
    scaled.width = Math.ceil((width * scaled.height / height) / 2) * 2;
    try {
      await resizer.resize(image, scaled, options);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Could not allocate square crop canvas.");
      context.imageSmoothingEnabled = false;
      context.drawImage(scaled, (scaled.width - canvas.width) / 2, 0,
        canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      scaled.width = 0;
      scaled.height = 0;
    }
  }

  return { upscale };
});
