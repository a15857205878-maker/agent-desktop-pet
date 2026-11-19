const STYLE_ELEMENT_ATTR = 'data-floating-scene-panel-style';
const DEFAULT_PADDING = 12;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 240;
const KEYBOARD_STEP = 16;
const KEYBOARD_LARGE_STEP = 48;

let styleRefCount = 0;

function toFiniteNonNegative(value, fallback) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clampAxis(value, size, viewport, padding) {
  const fitsWithPadding = size + padding * 2 <= viewport;
  const min = fitsWithPadding ? padding : 0;
  const max = fitsWithPadding
    ? viewport - size - padding
    : Math.max(0, viewport - size);
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(Math.max(safeValue, min), max);
}

/**
 * Clamp a floating panel's top-left coordinates within the current viewport.
 * Falls back gracefully for non-finite inputs and small/narrow viewports.
 */
export function clampFloatingPanel({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  padding = DEFAULT_PADDING,
} = {}) {
  const safePadding = toFiniteNonNegative(padding, DEFAULT_PADDING);
  const safeViewportW = toFiniteNonNegative(viewportWidth, 0);
  const safeViewportH = toFiniteNonNegative(viewportHeight, 0);
  const safeWidth = toFiniteNonNegative(width, 0);
  const safeHeight = toFiniteNonNegative(height, 0);

  return {
    x: clampAxis(x, safeWidth, safeViewportW, safePadding),
    y: clampAxis(y, safeHeight, safeViewportH, safePadding),
  };
}

function getPanelStyles() {
  return `
.floating-scene-panel {
  position: fixed;
  z-index: 6;
  box-sizing: border-box;
  width: min(300px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--moon-ink, #ece6da);
  background: var(--moon-panel, rgba(28, 33, 48, 0.94));
  border: 1px solid var(--moon-edge, #6f6880);
  border-radius: var(--moon-radius, 16px);
  box-shadow: 0 12px 30px rgba(10, 14, 24, 0.42);
  backdrop-filter: blur(10px);
  font-size: 13px;
  pointer-events: auto;
}
.floating-scene-panel[hidden] {
  display: none !important;
}
.floating-scene-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 9px 10px 9px 12px;
  border-bottom: 1px solid var(--moon-line, rgba(160, 152, 178, 0.25));
  background: var(--moon-card, rgba(39, 45, 64, 0.72));
}
.floating-scene-panel-handle {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 10px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.floating-scene-panel[data-dragging="true"] .floating-scene-panel-handle {
  cursor: grabbing;
}
.floating-scene-panel-handle:focus-visible {
  outline: 2px solid var(--moon-gold, #e2c178);
  outline-offset: 2px;
}
.floating-scene-panel-grip {
  flex-shrink: 0;
  color: var(--moon-muted, #b8b0c2);
  font-size: 12px;
  line-height: 1;
  letter-spacing: 1px;
  opacity: 0.75;
}
.floating-scene-panel-title {
  margin: 0;
  font-family: 'STZhongsong', 'SimSun', serif;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--moon-title, #f4e8cd);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.floating-scene-panel-close {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid transparent;
  background: transparent;
  color: var(--moon-muted, #b8b0c2);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.floating-scene-panel-close:hover,
.floating-scene-panel-close:focus-visible {
  background: var(--moon-hover, rgba(255, 255, 255, 0.08));
  border-color: var(--moon-edge, #6f6880);
  color: var(--moon-ink, #ece6da);
}
.floating-scene-panel-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scrollbar-width: thin;
  scrollbar-color: var(--moon-edge, #6f6880) transparent;
}
.floating-scene-panel-body > * {
  max-width: 100%;
  box-sizing: border-box;
}
body.yard-page .floating-scene-panel-body > header,
.floating-scene-panel-body > header {
  position: static;
  inset: auto;
  left: auto;
  right: auto;
  top: auto;
  bottom: auto;
  transform: none;
  z-index: auto;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}
body.yard-page .floating-scene-panel-body > header > strong,
.floating-scene-panel-body > header > strong {
  display: none;
}
body.yard-page .floating-scene-panel-body > header > button,
.floating-scene-panel-body > header > button {
  flex: 1 1 auto;
  min-height: 32px;
}
body.yard-page .floating-scene-panel-body #district-nav,
.floating-scene-panel-body #district-nav {
  position: static;
  inset: auto;
  left: auto;
  right: auto;
  top: auto;
  bottom: auto;
  transform: none;
  z-index: auto;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  background: var(--moon-card, rgba(39, 45, 64, 0.65));
  border: 1px solid var(--moon-line, rgba(160, 152, 178, 0.25));
  border-radius: 12px;
}
body.yard-page .floating-scene-panel-body #district-nav button,
.floating-scene-panel-body #district-nav button {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 30px;
  padding: 5px 8px;
}
body.yard-page .floating-scene-panel-body #town-tool-tray,
.floating-scene-panel-body #town-tool-tray {
  position: static;
  inset: auto;
  left: auto;
  right: auto;
  top: auto;
  bottom: auto;
  transform: none;
  z-index: auto;
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  background: var(--moon-card, rgba(39, 45, 64, 0.65));
  border: 1px solid var(--moon-line, rgba(160, 152, 178, 0.25));
  border-radius: 13px;
  box-shadow: none;
}
body.yard-page .floating-scene-panel-body #town-tool-tray button,
.floating-scene-panel-body #town-tool-tray button {
  width: 100%;
  min-width: 0;
  justify-content: center;
  padding: 8px 8px;
  gap: 6px;
}
@media (prefers-reduced-motion: reduce) {
  .floating-scene-panel,
  .floating-scene-panel * {
    transition: none;
  }
}
`;
}

function retainStyles(doc) {
  if (!doc?.head) return null;
  let styleEl = doc.head.querySelector(`style[${STYLE_ELEMENT_ATTR}="true"]`);
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.setAttribute(STYLE_ELEMENT_ATTR, 'true');
    styleEl.textContent = getPanelStyles();
    doc.head.appendChild(styleEl);
  }
  styleRefCount += 1;
  return styleEl;
}

function releaseStyles(doc) {
  if (styleRefCount > 0) {
    styleRefCount -= 1;
  }
  if (styleRefCount === 0 && doc?.head) {
    const styleEl = doc.head.querySelector(`style[${STYLE_ELEMENT_ATTR}="true"]`);
    styleEl?.remove();
  }
}

function readStoredPosition(storageKey) {
  if (typeof storageKey !== 'string' || !storageKey) return null;
  try {
    const storage = globalThis.window?.localStorage;
    if (!storage) return null;
    const raw = storage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y)
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Ignore unavailable or invalid localStorage.
  }
  return null;
}

function writeStoredPosition(storageKey, position) {
  if (typeof storageKey !== 'string' || !storageKey) return;
  try {
    const storage = globalThis.window?.localStorage;
    if (!storage) return;
    storage.setItem(
      storageKey,
      JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) })
    );
  } catch {
    // Ignore storage write failures.
  }
}

function normalizeContents(contents) {
  if (!contents) return [];
  if (typeof contents[Symbol.iterator] === 'function' && typeof contents !== 'string') {
    return Array.from(contents).filter(Boolean);
  }
  return [contents];
}

function measureViewport() {
  const win = globalThis.window;
  const docEl = globalThis.document?.documentElement;
  const viewportWidth = Number.isFinite(win?.innerWidth)
    ? win.innerWidth
    : docEl?.clientWidth || 0;
  const viewportHeight = Number.isFinite(win?.innerHeight)
    ? win.innerHeight
    : docEl?.clientHeight || 0;
  return { viewportWidth, viewportHeight };
}

function measurePanel(root) {
  const rect = root.getBoundingClientRect?.();
  const width = rect && rect.width > 0 ? rect.width : root.offsetWidth || DEFAULT_WIDTH;
  const height = rect && rect.height > 0 ? rect.height : root.offsetHeight || DEFAULT_HEIGHT;
  return { width, height };
}

/**
 * Create a reusable, draggable, non-modal floating scene-tool panel that moves
 * existing DOM controls inside itself and restores them on dispose.
 */
export function createFloatingScenePanel({
  id = 'floating-scene-panel',
  title = '场景工具',
  contents = [],
  onChange = () => {},
  onClose = () => {},
  storageKey,
} = {}) {
  const doc = globalThis.document;
  if (!doc) {
    throw new Error('createFloatingScenePanel requires a DOM document');
  }

  retainStyles(doc);

  const root = doc.createElement('section');
  root.className = 'floating-scene-panel';
  if (id) {
    root.id = id;
  }
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'false');
  root.hidden = true;
  root.dataset.open = 'false';
  root.dataset.dragging = 'false';

  const headerEl = doc.createElement('div');
  headerEl.className = 'floating-scene-panel-header';

  const handleEl = doc.createElement('div');
  handleEl.className = 'floating-scene-panel-handle';
  handleEl.tabIndex = 0;
  handleEl.setAttribute('role', 'group');
  handleEl.setAttribute('aria-roledescription', '可拖动标题栏');

  const gripEl = doc.createElement('span');
  gripEl.className = 'floating-scene-panel-grip';
  gripEl.setAttribute('aria-hidden', 'true');
  gripEl.textContent = '⋮⋮';

  const titleEl = doc.createElement('h2');
  titleEl.className = 'floating-scene-panel-title';
  const titleId = `${id || 'floating-scene-panel'}-title`;
  titleEl.id = titleId;
  titleEl.textContent = title || '场景工具';
  root.setAttribute('aria-labelledby', titleId);

  handleEl.appendChild(gripEl);
  handleEl.appendChild(titleEl);

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'floating-scene-panel-close';
  closeBtn.setAttribute('aria-label', `关闭${titleEl.textContent}`);
  closeBtn.textContent = '×';

  headerEl.appendChild(handleEl);
  headerEl.appendChild(closeBtn);

  const bodyEl = doc.createElement('div');
  bodyEl.className = 'floating-scene-panel-body';

  root.appendChild(headerEl);
  root.appendChild(bodyEl);

  // Move existing DOM nodes into panel body while leaving placeholders for exact restore.
  const movedEntries = [];
  for (const node of normalizeContents(contents)) {
    let placeholder = null;
    if (node.parentNode) {
      placeholder = doc.createComment(`floating-panel-placeholder:${node.id || node.tagName || 'node'}`);
      node.parentNode.insertBefore(placeholder, node);
    }
    movedEntries.push({ node, placeholder });
    bodyEl.appendChild(node);
  }

  let open = false;
  let dragging = false;
  let disposed = false;
  let activePointerId = null;
  let startPointerX = 0;
  let startPointerY = 0;
  let startPanelX = 0;
  let startPanelY = 0;

  const initialStored = readStoredPosition(storageKey);
  const initialViewport = measureViewport();
  let position = clampFloatingPanel({
    x: initialStored?.x ?? DEFAULT_PADDING,
    y: initialStored?.y ?? DEFAULT_PADDING,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    viewportWidth: initialViewport.viewportWidth,
    viewportHeight: initialViewport.viewportHeight,
    padding: DEFAULT_PADDING,
  });

  let lastNotified = null;

  function applyPosition(nextPos) {
    position = nextPos;
    root.style.left = `${position.x}px`;
    root.style.top = `${position.y}px`;
  }

  function clampToViewport() {
    const { viewportWidth, viewportHeight } = measureViewport();
    const { width, height } = measurePanel(root);
    const clamped = clampFloatingPanel({
      x: position.x,
      y: position.y,
      width,
      height,
      viewportWidth,
      viewportHeight,
      padding: DEFAULT_PADDING,
    });
    const moved = clamped.x !== position.x || clamped.y !== position.y;
    applyPosition(clamped);
    return { moved, width, height };
  }

  function notifyChange(isDragging) {
    if (disposed) return;
    const { width, height } = measurePanel(root);
    const signature = `${open}|${isDragging}|${position.x}|${position.y}|${width}|${height}`;
    if (signature === lastNotified) return;
    lastNotified = signature;
    onChange({ dragging: Boolean(isDragging) });
  }

  applyPosition(position);

  function stopBubbling(event) {
    event.stopPropagation();
  }

  function handlePointerDown(event) {
    if (disposed || !open) return;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('button')) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    activePointerId = event.pointerId;
    dragging = true;
    startPointerX = event.clientX;
    startPointerY = event.clientY;
    startPanelX = position.x;
    startPanelY = position.y;
    root.dataset.dragging = 'true';

    try {
      handleEl.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported in the current environment.
    }

    notifyChange(true);
  }

  function handlePointerMove(event) {
    if (disposed || !dragging || event.pointerId !== activePointerId) return;
    event.stopPropagation();

    const dx = event.clientX - startPointerX;
    const dy = event.clientY - startPointerY;
    const { viewportWidth, viewportHeight } = measureViewport();
    const { width, height } = measurePanel(root);
    const clamped = clampFloatingPanel({
      x: startPanelX + dx,
      y: startPanelY + dy,
      width,
      height,
      viewportWidth,
      viewportHeight,
      padding: DEFAULT_PADDING,
    });

    if (clamped.x !== position.x || clamped.y !== position.y) {
      applyPosition(clamped);
      notifyChange(true);
    }
  }

  function finishDrag(event) {
    if (!dragging) return;
    if (event?.type !== 'lostpointercapture' && event?.pointerId !== activePointerId) {
      return;
    }
    event?.stopPropagation?.();

    const capturedId = activePointerId;
    dragging = false;
    activePointerId = null;
    root.dataset.dragging = 'false';

    try {
      if (capturedId !== null && handleEl.hasPointerCapture?.(capturedId)) {
        handleEl.releasePointerCapture?.(capturedId);
      }
    } catch {
      // Ignore release errors.
    }

    clampToViewport();
    writeStoredPosition(storageKey, position);
    notifyChange(false);
  }

  function handleKeyDown(event) {
    if (disposed || !open) return;
    const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
    let dx = 0;
    let dy = 0;

    switch (event.key) {
      case 'ArrowLeft':
        dx = -step;
        break;
      case 'ArrowRight':
        dx = step;
        break;
      case 'ArrowUp':
        dy = -step;
        break;
      case 'ArrowDown':
        dy = step;
        break;
      default:
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const { viewportWidth, viewportHeight } = measureViewport();
    const { width, height } = measurePanel(root);
    const clamped = clampFloatingPanel({
      x: position.x + dx,
      y: position.y + dy,
      width,
      height,
      viewportWidth,
      viewportHeight,
      padding: DEFAULT_PADDING,
    });

    if (clamped.x !== position.x || clamped.y !== position.y) {
      applyPosition(clamped);
      writeStoredPosition(storageKey, position);
      notifyChange(false);
    }
  }

  function handleCloseClick(event) {
    event.stopPropagation();
    if (disposed) return;
    setOpen(false);
    onClose();
  }

  function handleViewportResize() {
    if (disposed || !open) return;
    const { moved } = clampToViewport();
    if (moved) {
      writeStoredPosition(storageKey, position);
    }
    notifyChange(dragging);
  }

  root.addEventListener('pointerdown', stopBubbling);
  root.addEventListener('pointerup', stopBubbling);
  root.addEventListener('click', stopBubbling);
  root.addEventListener('wheel', stopBubbling);

  handleEl.addEventListener('pointerdown', handlePointerDown);
  handleEl.addEventListener('pointermove', handlePointerMove);
  handleEl.addEventListener('pointerup', finishDrag);
  handleEl.addEventListener('pointercancel', finishDrag);
  handleEl.addEventListener('lostpointercapture', finishDrag);
  handleEl.addEventListener('keydown', handleKeyDown);
  closeBtn.addEventListener('click', handleCloseClick);

  const win = globalThis.window;
  win?.addEventListener?.('resize', handleViewportResize);

  let resizeObserver = null;
  if (typeof globalThis.ResizeObserver === 'function') {
    resizeObserver = new globalThis.ResizeObserver(() => {
      if (disposed || !open) return;
      clampToViewport();
      notifyChange(dragging);
    });
    resizeObserver.observe(root);
  }

  function setOpen(value) {
    if (disposed) return;
    const nextOpen = Boolean(value);
    if (nextOpen === open) return;

    open = nextOpen;
    root.hidden = !open;
    root.dataset.open = open ? 'true' : 'false';

    if (!open && dragging) {
      dragging = false;
      activePointerId = null;
      root.dataset.dragging = 'false';
    }

    if (open) {
      clampToViewport();
    }

    notifyChange(false);
  }

  function getState() {
    const { width, height } = measurePanel(root);
    return {
      open,
      dragging,
      x: position.x,
      y: position.y,
      width,
      height,
    };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    open = false;
    dragging = false;
    activePointerId = null;

    root.removeEventListener('pointerdown', stopBubbling);
    root.removeEventListener('pointerup', stopBubbling);
    root.removeEventListener('click', stopBubbling);
    root.removeEventListener('wheel', stopBubbling);

    handleEl.removeEventListener('pointerdown', handlePointerDown);
    handleEl.removeEventListener('pointermove', handlePointerMove);
    handleEl.removeEventListener('pointerup', finishDrag);
    handleEl.removeEventListener('pointercancel', finishDrag);
    handleEl.removeEventListener('lostpointercapture', finishDrag);
    handleEl.removeEventListener('keydown', handleKeyDown);
    closeBtn.removeEventListener('click', handleCloseClick);

    win?.removeEventListener?.('resize', handleViewportResize);
    resizeObserver?.disconnect();
    resizeObserver = null;

    for (let i = movedEntries.length - 1; i >= 0; i -= 1) {
      const { node, placeholder } = movedEntries[i];
      if (placeholder?.parentNode) {
        placeholder.parentNode.replaceChild(node, placeholder);
      } else if (node.parentNode === bodyEl) {
        bodyEl.removeChild(node);
      }
    }
    movedEntries.length = 0;

    root.remove();
    releaseStyles(doc);
  }

  return {
    root,
    setOpen,
    getState,
    dispose,
  };
}
