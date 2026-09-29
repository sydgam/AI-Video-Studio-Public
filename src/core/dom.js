export function getElement(selector) {
  return document.querySelector(selector);
}

export function getElements(selector) {
  return Array.from(document.querySelectorAll(selector));
}
