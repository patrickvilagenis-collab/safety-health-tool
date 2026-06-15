// hazardWheel.js — the official Schindler Hazard Wheel graphic, embedded as an
// image (rendered from the provided vector at high resolution).

export function hazardWheelSVG(size = 300) {
  return `<img class="hazard-wheel" src="./assets/hazard-wheel.png" alt="Schindler Hazard Wheel" loading="lazy" style="width:${size}px;max-width:92%">`;
}
