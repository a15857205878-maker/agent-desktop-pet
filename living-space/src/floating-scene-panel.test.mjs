import test from 'node:test';
import assert from 'node:assert/strict';
import { clampFloatingPanel, createFloatingScenePanel } from './floating-scene-panel.mjs';

test('clampFloatingPanel keeps in-bounds coordinates unchanged', () => {
  const result = clampFloatingPanel({
    x: 40,
    y: 80,
    width: 300,
    height: 320,
    viewportWidth: 1024,
    viewportHeight: 768,
    padding: 12,
  });
  assert.deepEqual(result, { x: 40, y: 80 });
});

test('clampFloatingPanel clamps out-of-bounds coordinates on 390x600 viewport', () => {
  assert.deepEqual(
    clampFloatingPanel({
      x: -120,
      y: -40,
      width: 300,
      height: 360,
      viewportWidth: 390,
      viewportHeight: 600,
    }),
    { x: 12, y: 12 }
  );

  assert.deepEqual(
    clampFloatingPanel({
      x: 500,
      y: 700,
      width: 300,
      height: 360,
      viewportWidth: 390,
      viewportHeight: 600,
    }),
    { x: 78, y: 228 }
  );
});

test('clampFloatingPanel bounds small windows without negative overflow', () => {
  assert.deepEqual(
    clampFloatingPanel({
      x: 50,
      y: 50,
      width: 300,
      height: 320,
      viewportWidth: 310,
      viewportHeight: 330,
      padding: 12,
    }),
    { x: 10, y: 10 }
  );

  assert.deepEqual(
    clampFloatingPanel({
      x: -20,
      y: 100,
      width: 300,
      height: 320,
      viewportWidth: 260,
      viewportHeight: 200,
      padding: 12,
    }),
    { x: 0, y: 0 }
  );
});

test('clampFloatingPanel handles invalid and non-finite coordinates safely', () => {
  const res1 = clampFloatingPanel({
    x: Number.NaN,
    y: Number.POSITIVE_INFINITY,
    width: 300,
    height: 240,
    viewportWidth: 390,
    viewportHeight: 600,
  });
  assert.deepEqual(res1, { x: 12, y: 12 });

  const res2 = clampFloatingPanel({
    x: 50,
    y: 50,
    width: Number.NaN,
    height: -10,
    viewportWidth: Number.NaN,
    viewportHeight: -100,
    padding: Number.NaN,
  });
  assert.deepEqual(res2, { x: 0, y: 0 });
});

function createMockDom({ width = 390, height = 600, storage } = {}) {
  class MockNode {
    constructor(nodeType, tagName = '') {
      this.nodeType = nodeType;
      this.tagName = tagName;
      this.parentNode = null;
      this.childNodes = [];
    }
    insertBefore(newNode, refNode) {
      if (newNode.parentNode) {
        newNode.parentNode.removeChild(newNode);
      }
      newNode.parentNode = this;
      if (!refNode) {
        this.childNodes.push(newNode);
        return newNode;
      }
      const idx = this.childNodes.indexOf(refNode);
      if (idx === -1) {
        this.childNodes.push(newNode);
      } else {
        this.childNodes.splice(idx, 0, newNode);
      }
      return newNode;
    }
    appendChild(node) {
      return this.insertBefore(node, null);
    }
    removeChild(node) {
      const idx = this.childNodes.indexOf(node);
      if (idx !== -1) {
        this.childNodes.splice(idx, 1);
        node.parentNode = null;
      }
      return node;
    }
    replaceChild(newNode, oldNode) {
      const idx = this.childNodes.indexOf(oldNode);
      if (idx === -1) return oldNode;
      if (newNode.parentNode) {
        newNode.parentNode.removeChild(newNode);
      }
      this.childNodes.splice(idx, 1, newNode);
      newNode.parentNode = this;
      oldNode.parentNode = null;
      return oldNode;
    }
    remove() {
      this.parentNode?.removeChild(this);
    }
  }

  class MockElement extends MockNode {
    constructor(tagName) {
      super(1, tagName.toUpperCase());
      this.id = '';
      this.className = '';
      this.hidden = false;
      this.tabIndex = -1;
      this.type = '';
      this.textContent = '';
      this.style = {};
      this.dataset = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.capturedPointers = new Set();
      this.offsetWidth = 300;
      this.offsetHeight = 240;
    }
    setAttribute(name, value) {
      const str = String(value);
      this.attributes.set(name, str);
      if (name === 'id') this.id = str;
    }
    getAttribute(name) {
      if (name === 'id') return this.id || null;
      return this.attributes.get(name) ?? null;
    }
    querySelector(selector) {
      const attrMatch = /^style\[([^=\]]+)="([^"]*)"\]$/.exec(selector);
      for (const child of this.childNodes) {
        if (child.nodeType !== 1) continue;
        if (attrMatch) {
          if (
            child.tagName === 'STYLE' &&
            child.getAttribute(attrMatch[1]) === attrMatch[2]
          ) {
            return child;
          }
        }
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    }
    closest(selector) {
      let curr = this;
      while (curr && curr.nodeType === 1) {
        if (selector === 'button' && curr.tagName === 'BUTTON') return curr;
        curr = curr.parentNode;
      }
      return null;
    }
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(fn);
    }
    removeEventListener(type, fn) {
      this.listeners.get(type)?.delete(fn);
    }
    dispatchEvent(event) {
      const evt = {
        target: this,
        defaultPrevented: false,
        propagationStopped: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {
          this.propagationStopped = true;
        },
        ...event,
      };
      let curr = this;
      while (curr) {
        const set = curr.listeners?.get(evt.type);
        if (set) {
          for (const fn of [...set]) {
            fn(evt);
          }
        }
        if (evt.propagationStopped) break;
        curr = curr.parentNode;
      }
      return evt;
    }
    setPointerCapture(pointerId) {
      this.capturedPointers.add(pointerId);
    }
    hasPointerCapture(pointerId) {
      return this.capturedPointers.has(pointerId);
    }
    releasePointerCapture(pointerId) {
      this.capturedPointers.delete(pointerId);
    }
    getBoundingClientRect() {
      return { width: this.offsetWidth, height: this.offsetHeight };
    }
  }

  const head = new MockElement('head');
  const body = new MockElement('body');
  const documentElement = new MockElement('html');
  documentElement.clientWidth = width;
  documentElement.clientHeight = height;

  const winListeners = new Map();
  const mockWindow = {
    innerWidth: width,
    innerHeight: height,
    localStorage: storage,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatchResize(nextW, nextH) {
      this.innerWidth = nextW;
      this.innerHeight = nextH;
      for (const fn of [...(winListeners.get('resize') ?? [])]) {
        fn();
      }
    },
    listenerCount(type) {
      return winListeners.get(type)?.size ?? 0;
    },
  };

  const mockDocument = {
    head,
    body,
    documentElement,
    createElement: (tag) => new MockElement(tag),
    createComment: (text) => ({ nodeType: 8, data: text, parentNode: null }),
  };

  globalThis.window = mockWindow;
  globalThis.document = mockDocument;

  return { mockWindow, mockDocument, head, body };
}

test('createFloatingScenePanel lifecycle, placeholder restore, callbacks, and dispose', () => {
  const storageMap = new Map([['yard-panel-pos', '{invalid-json']]);
  const storage = {
    getItem: (k) => storageMap.get(k) ?? null,
    setItem: (k, v) => storageMap.set(k, v),
  };
  const { mockWindow, head, body } = createMockDom({ width: 390, height: 600, storage });

  const header = globalThis.document.createElement('header');
  const nav = globalThis.document.createElement('nav');
  nav.id = 'district-nav';
  const tray = globalThis.document.createElement('nav');
  tray.id = 'town-tool-tray';
  const canvas = globalThis.document.createElement('canvas');

  body.appendChild(header);
  body.appendChild(nav);
  body.appendChild(tray);
  body.appendChild(canvas);

  const changes = [];
  let closes = 0;

  const panel = createFloatingScenePanel({
    id: 'yard-tools-panel',
    title: '小屋手记',
    contents: [header, nav, tray],
    onChange: (state) => changes.push(state),
    onClose: () => {
      closes += 1;
    },
    storageKey: 'yard-panel-pos',
  });

  body.appendChild(panel.root);

  assert.equal(panel.root.getAttribute('role'), 'dialog');
  assert.equal(panel.root.getAttribute('aria-modal'), 'false');
  assert.equal(panel.root.hidden, true);
  assert.equal(panel.getState().open, false);
  assert.equal(head.childNodes.length, 1);
  assert.equal(header.parentNode.className, 'floating-scene-panel-body');

  // Programmatic setOpen does not invoke onClose or emit redundant changes.
  panel.setOpen(true);
  panel.setOpen(true);
  assert.equal(panel.root.hidden, false);
  assert.equal(panel.getState().open, true);
  assert.equal(closes, 0);
  assert.deepEqual(changes, [{ dragging: false }]);

  panel.setOpen(false);
  assert.equal(closes, 0);
  assert.deepEqual(changes, [{ dragging: false }, { dragging: false }]);

  // Close button invokes onClose.
  panel.setOpen(true);
  const closeBtn = panel.root.childNodes[0].childNodes[1];
  closeBtn.dispatchEvent({ type: 'click' });
  assert.equal(panel.getState().open, false);
  assert.equal(closes, 1);

  // Dispose restores exact DOM order and cleans up listeners/styles/root once.
  panel.dispose();
  panel.dispose();
  assert.deepEqual(body.childNodes, [header, nav, tray, canvas]);
  assert.equal(head.childNodes.length, 0);
  assert.equal(mockWindow.listenerCount('resize'), 0);

  delete globalThis.window;
  delete globalThis.document;
});

test('createFloatingScenePanel handles pointer drag, keyboard arrows, resize clamp, and storage errors', () => {
  const brokenStorage = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  const { mockWindow, body } = createMockDom({
    width: 390,
    height: 600,
    storage: brokenStorage,
  });

  const panel = createFloatingScenePanel({
    id: 'drag-test-panel',
    title: '测试面板',
    contents: [],
    storageKey: 'broken-key',
  });
  body.appendChild(panel.root);
  panel.setOpen(true);

  const headerEl = panel.root.childNodes[0];
  const handleEl = headerEl.childNodes[0];
  const closeBtn = headerEl.childNodes[1];

  // Clicking close button inside header must not initiate drag.
  const btnEvt = closeBtn.dispatchEvent({
    type: 'pointerdown',
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: 10,
    clientY: 10,
  });
  assert.equal(panel.getState().dragging, false);
  assert.equal(btnEvt.propagationStopped, true);

  // Pointer drag on handle captures pointer and clamps to viewport.
  handleEl.dispatchEvent({
    type: 'pointerdown',
    pointerId: 2,
    pointerType: 'mouse',
    button: 0,
    clientX: 20,
    clientY: 20,
  });
  assert.equal(panel.getState().dragging, true);
  assert.equal(handleEl.hasPointerCapture(2), true);

  handleEl.dispatchEvent({
    type: 'pointermove',
    pointerId: 2,
    clientX: 500,
    clientY: 500,
  });
  assert.deepEqual(
    { x: panel.getState().x, y: panel.getState().y },
    { x: 78, y: 348 }
  );

  handleEl.dispatchEvent({
    type: 'pointercancel',
    pointerId: 2,
  });
  assert.equal(panel.getState().dragging, false);

  // Keyboard arrow keys move panel within bounds.
  handleEl.dispatchEvent({ type: 'keydown', key: 'ArrowLeft' });
  assert.equal(panel.getState().x, 62);

  // Window resize clamps panel to smaller viewport.
  mockWindow.dispatchResize(310, 300);
  assert.deepEqual(
    { x: panel.getState().x, y: panel.getState().y },
    { x: 10, y: 48 }
  );

  panel.dispose();
  delete globalThis.window;
  delete globalThis.document;
});
