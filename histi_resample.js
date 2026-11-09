(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.HISTI_RESAMPLE = factory(root.pica);
})(typeof globalThis !== "undefined" ? globalThis : this, function (createPica) {
  "use strict";
  let resizer;

  async function upscale(image, canvas) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width !== 1920 || height !== 1080 || canvas.width !== 3840 || canvas.height !== 2160) {
      throw new Error("Lanczos upscale requires 1920x1080 input and 3840x2160 output.");
    }
    if (typeof createPica !== "function") throw new Error("The bundled Lanczos resampler could not be loaded.");
    // Native browser scaling does not guarantee a Lanczos kernel.
    if (!resizer) resizer = createPica({ features: ["js", "wasm", "ww"], concurrency: 2 });
    return resizer.resize(image, canvas, { filter: "lanczos3", unsharpAmount: 0 });
  }

  return { upscale };
});
