export function logInfo(message, detail) {
  if (detail !== undefined) {
    console.info(message, detail);
    return;
  }

  console.info(message);
}

export function logWarning(message, detail) {
  if (detail !== undefined) {
    console.warn(message, detail);
    return;
  }

  console.warn(message);
}
