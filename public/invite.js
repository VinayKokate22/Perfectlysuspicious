export function checkedInvite(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) throw new Error('Invite unavailable');
  const url = new URL(value);
  if (!url.hostname || url.username || url.password) throw new Error('Invite unavailable');
  return value;
}

export function localInvite(room, href) {
  const url = new URL(checkedInvite(href));
  url.search = ''; url.hash = ''; url.searchParams.set('room', room);
  return url.href;
}

export function isComputerInvite(href) {
  const host = new URL(href).hostname.toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || /^127\./.test(host) || host === '[::1]';
}

// Clipboard access can be unavailable or denied in an embedded game. Never
// report success unless the browser confirms a write or copy operation.
export async function copyInviteText(value) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; }
  } catch {}
  const active = document.activeElement;
  const field = document.createElement('textarea');
  field.value = value; field.readOnly = true; field.tabIndex = -1;
  field.setAttribute('aria-label', 'Copy invitation');
  field.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  // A modal makes the rest of the document inert, including a body level field.
  (document.querySelector('dialog[open]') ?? document.body).append(field);
  try {
    field.focus({preventScroll:true}); field.select();
    return document.execCommand('copy') === true;
  } catch { return false; }
  finally { field.remove(); active?.focus({preventScroll:true}); }
}
