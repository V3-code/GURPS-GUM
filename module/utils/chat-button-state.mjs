/**
 * Run an asynchronous chat action without relying on Event.currentTarget after
 * the chat message is rerendered. The captured element may become disconnected,
 * but it remains a valid object for the duration of the action.
 */
export async function runWithChatButtonDisabled(button, action) {
  if (!button || button.disabled) return false;
  button.disabled = true;
  try {
    await action();
    return true;
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}