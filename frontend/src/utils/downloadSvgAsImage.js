const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const STYLE_PROPS = [
  "color",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "opacity",
  "font",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "letter-spacing",
  "word-spacing",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
  "shape-rendering",
  "transform-origin",
  "transform-box",
];

const getSvgSize = (svgElement) => {
  const rect = svgElement.getBoundingClientRect();
  const viewBox = svgElement.viewBox?.baseVal;
  const width = Math.max(
    1,
    Math.round(rect.width || svgElement.clientWidth || viewBox?.width || 1600),
  );
  const height = Math.max(
    1,
    Math.round(
      rect.height || svgElement.clientHeight || viewBox?.height || 900,
    ),
  );

  return { width, height };
};

const copyComputedStyles = (sourceNode, targetNode) => {
  if (!(sourceNode instanceof Element) || !(targetNode instanceof Element))
    return;

  const computed = window.getComputedStyle(sourceNode);
  const styleText = STYLE_PROPS.map(
    (prop) => `${prop}:${computed.getPropertyValue(prop)};`,
  ).join("");

  if (styleText) {
    targetNode.setAttribute("style", styleText);
  }

  if (targetNode.tagName.toLowerCase() === "text") {
    targetNode.setAttribute(
      "fill",
      computed.fill || computed.color || "currentColor",
    );
  }

  targetNode.removeAttribute("class");
  targetNode.removeAttribute("tabindex");
  targetNode.removeAttribute("aria-label");
  targetNode.removeAttribute("aria-hidden");
  targetNode.removeAttribute("data-node-id");

  const sourceChildren = Array.from(sourceNode.children);
  const targetChildren = Array.from(targetNode.children);
  sourceChildren.forEach((child, index) => {
    copyComputedStyles(child, targetChildren[index]);
  });
};

const serializeSvg = (svgElement) => {
  const clone = svgElement.cloneNode(true);
  const { width, height } = getSvgSize(svgElement);

  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", XLINK_NS);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  copyComputedStyles(svgElement, clone);

  const background =
    window.getComputedStyle(document.body).backgroundColor || "#ffffff";
  const bgRect = document.createElementNS(SVG_NS, "rect");
  bgRect.setAttribute("x", "0");
  bgRect.setAttribute("y", "0");
  bgRect.setAttribute("width", String(width));
  bgRect.setAttribute("height", String(height));
  bgRect.setAttribute("fill", background);
  clone.insertBefore(bgRect, clone.firstChild);

  return {
    width,
    height,
    svgMarkup: new XMLSerializer().serializeToString(clone),
  };
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

const downloadBlob = (blob, filename) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};

const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error("Failed to export PNG blob."));
    }, "image/png");
  });

export const downloadSvgAsImage = async (
  svgElement,
  filename = "learning-map",
) => {
  if (!svgElement) return;

  const { width, height, svgMarkup } = serializeSvg(svgElement);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas rendering context is unavailable.");
    }

    context.scale(2, 2);
    context.fillStyle =
      window.getComputedStyle(document.body).backgroundColor || "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await canvasToBlob(canvas);
    downloadBlob(pngBlob, `${filename}.png`);
  } catch (error) {
    const svgBlob = new Blob([svgMarkup], {
      type: "image/svg+xml;charset=utf-8",
    });
    downloadBlob(svgBlob, `${filename}.svg`);
    console.warn("PNG export failed, fell back to SVG download.", error);
  }
};
