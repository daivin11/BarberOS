export const getRequiredElementById = (documentRef, elementId) => {
  const element = documentRef?.getElementById?.(elementId);

  if (!element) {
    throw new Error(`Required DOM element not found: #${elementId}`);
  }

  return element;
};

