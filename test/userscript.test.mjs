import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const script = await readFile(new URL('../bilibili-trackpad-volume.user.js', import.meta.url), 'utf8');
const packageInfo = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

function environment({ mode = 'full', classes = [], kind = 'picture', preexisting } = {}) {
  // Each fixture has its own prototype. Host/Node EventTarget is never patched.
  class PageEventTarget extends EventTarget {}
  const window = new PageEventTarget();
  const root = { getAttribute: name => name === 'data-screen' ? mode : null };
  const excluded = {
    controls: '.bpx-player-control-wrap',
    input: 'input',
    textarea: 'textarea',
    select: 'select',
    editable: '[contenteditable="true"]',
  };
  const target = {
    closest(selector) {
      if (selector === '.bpx-player-container') return kind === 'outside' ? null : root;
      if (selector === '.bpx-player-video-area') {
        return ['outside', 'outside-picture'].includes(kind) ? null : this;
      }
      return selector.split(',').includes(excluded[kind]) ? this : null;
    },
  };

  class WheelInput extends Event {
    #values;
    constructor(type, values = {}) {
      super(type, { cancelable: true });
      this.#values = { deltaY: 12, deltaX: 0, wheelDelta: -36, wheelDeltaY: -36, ...values };
      Object.defineProperty(this, 'target', { value: target, configurable: true });
    }
    // Private-field getters model native, readonly, receiver-sensitive properties.
    get deltaY() { return this.#values.deltaY; }
    get deltaX() { return this.#values.deltaX; }
    get wheelDelta() { return this.#values.wheelDelta; }
    get wheelDeltaY() { return this.#values.wheelDeltaY; }
    get ctrlKey() { return Boolean(this.#values.ctrlKey); }
    get metaKey() { return Boolean(this.#values.metaKey); }
  }

  if (preexisting) window.addEventListener('wheel', preexisting);
  vm.runInNewContext(script, {
    EventTarget: PageEventTarget,
    document: { body: { classList: { contains: name => classes.includes(name) } } },
  }, { filename: 'bilibili-trackpad-volume.user.js' });

  return {
    window,
    other: new PageEventTarget(),
    input: (type = 'mousewheel', values) => new WheelInput(type, values),
    fire(type = 'mousewheel', values, receiver = window) {
      const event = new WheelInput(type, values);
      receiver.dispatchEvent(event);
      return event;
    },
  };
}

for (const mode of ['full', 'web', 'webfullscreen']) {
  test(`${mode}: reverse all native vertical direction values`, () => {
    const page = environment({ mode });
    let received;
    page.window.addEventListener('mousewheel', event => { received = event; });
    const original = page.fire();
    assert.equal(received.deltaY, -12);
    assert.equal(received.wheelDelta, 36);
    assert.equal(received.wheelDeltaY, 36);
    assert.equal(original.deltaY, 12);
    assert.equal(original.wheelDelta, -36);
    assert.equal(received.target, original.target);
    assert.equal(received.isTrusted, original.isTrusted);
  });
}

for (const mode of ['normal', 'wide', 'mini', 'unknown']) {
  test(`${mode}: pass the original event unchanged`, () => {
    const page = environment({ mode });
    let received;
    page.window.addEventListener('wheel', event => { received = event; });
    assert.equal(received, undefined);
    const original = page.fire('wheel');
    assert.equal(received, original);
    assert.equal(received.deltaY, 12);
  });
}

for (const name of ['player-mode-webfullscreen', 'player-mode-web']) {
  test(`support legacy body class ${name}`, () => {
    const page = environment({ mode: null, classes: [name] });
    let value;
    page.window.addEventListener('wheel', event => { value = event.deltaY; });
    page.fire('wheel');
    assert.equal(value, -12);
  });
}

for (const kind of ['outside', 'outside-picture', 'controls', 'input', 'textarea', 'select', 'editable']) {
  test(`${kind}: leave non-picture and editable areas untouched`, () => {
    const page = environment({ kind });
    let received;
    page.window.addEventListener('wheel', event => { received = event; });
    const original = page.fire('wheel');
    assert.equal(received, original);
  });
}

test('leave zoom gestures, predominantly horizontal gestures and zero movement unchanged', () => {
  for (const values of [{ ctrlKey: true }, { metaKey: true }, { deltaX: 30 }, { deltaY: 0 }]) {
    const page = environment();
    let received;
    page.window.addEventListener('wheel', event => { received = event; });
    const original = page.fire('wheel', values);
    assert.equal(received, original);
  }
});

test('both directions reach the native volume handler with opposite signs', () => {
  const page = environment();
  let volume = 0.5;
  page.window.addEventListener('mousewheel', event => {
    volume += Math.sign(event.wheelDelta) * 0.01;
  });
  page.fire('mousewheel', { deltaY: 12, wheelDelta: -36 });
  assert.equal(volume, 0.51);
  page.fire('mousewheel', { deltaY: -12, wheelDelta: 36 });
  assert.equal(volume, 0.5);
});

test('native Event getters, methods and callback receiver remain valid', () => {
  const page = environment();
  page.window.addEventListener('wheel', function (event) {
    assert.equal(this, page.window);
    assert.equal(event.currentTarget, page.window);
    assert.equal(event.type, 'wheel');
    assert.doesNotThrow(() => event.stopPropagation());
    event.preventDefault();
  });
  assert.equal(page.fire('wheel').defaultPrevented, true);
});

test('object listeners keep their handleEvent receiver', () => {
  const page = environment();
  let called = false;
  const listener = { handleEvent(event) {
    called = true;
    assert.equal(this, listener);
    assert.equal(event.deltaY, -12);
  } };
  page.window.addEventListener('wheel', listener);
  page.fire('wheel');
  assert.equal(called, true);
  page.window.removeEventListener('wheel', listener);
  called = false;
  page.fire('wheel');
  assert.equal(called, false);
});

test('duplicate registrations fire only once', () => {
  const page = environment();
  let calls = 0;
  const listener = () => { calls += 1; };
  page.window.addEventListener('wheel', listener);
  page.window.addEventListener('wheel', listener, { passive: true });
  page.fire('wheel');
  assert.equal(calls, 1);
});

test('removal preserves event type and capture identity', () => {
  const page = environment();
  let calls = 0;
  const listener = () => { calls += 1; };
  page.window.addEventListener('wheel', listener, false);
  page.window.addEventListener('wheel', listener, true);
  page.window.addEventListener('mousewheel', listener, false);
  page.window.removeEventListener('wheel', listener, { capture: true });
  page.fire('wheel');
  assert.equal(calls, 1);
  page.fire('mousewheel');
  assert.equal(calls, 2);
  page.window.removeEventListener('wheel', listener, false);
  page.fire('wheel');
  assert.equal(calls, 2);
});

test('removing a listener from one target leaves another target intact', () => {
  const page = environment();
  let calls = 0;
  const listener = () => { calls += 1; };
  page.window.addEventListener('wheel', listener);
  page.other.addEventListener('wheel', listener);
  page.window.removeEventListener('wheel', listener);
  page.fire('wheel');
  page.fire('wheel', {}, page.other);
  assert.equal(calls, 1);
});

test('once listeners can be registered again after native removal', () => {
  const page = environment();
  let calls = 0;
  const listener = () => { calls += 1; };
  page.window.addEventListener('wheel', listener, { once: true });
  page.fire('wheel');
  page.fire('wheel');
  assert.equal(calls, 1);
  page.window.addEventListener('wheel', listener, { once: true });
  page.fire('wheel');
  assert.equal(calls, 2);
});

test('AbortSignal keeps native cancellation behavior', () => {
  const page = environment();
  const controller = new AbortController();
  let calls = 0;
  page.window.addEventListener('wheel', () => { calls += 1; }, { signal: controller.signal });
  controller.abort();
  page.fire('wheel');
  assert.equal(calls, 0);
});

test('non-wheel listeners retain the original event', () => {
  const page = environment();
  let received;
  const listener = event => { received = event; };
  page.window.addEventListener('keydown', listener);
  const original = page.fire('keydown');
  assert.equal(received, original);
  page.window.removeEventListener('keydown', listener);
  received = undefined;
  page.fire('keydown');
  assert.equal(received, undefined);
});

test('listeners registered before the patch can still be removed', () => {
  let calls = 0;
  const preexisting = () => { calls += 1; };
  const page = environment({ preexisting });
  page.window.removeEventListener('wheel', preexisting);
  page.fire('wheel');
  assert.equal(calls, 0);
});

test('release metadata preserves local installation identity and narrow permissions', () => {
  const metadata = key => [...script.matchAll(new RegExp(`^// @${key}\\s+(.+)$`, 'gm'))].map(m => m[1]);
  assert.deepEqual(metadata('name'), ['Bilibili 网页全屏音量方向']);
  assert.deepEqual(metadata('namespace'), ['local.bilibili.webfull.volume']);
  assert.deepEqual(metadata('version'), [packageInfo.version]);
  assert.deepEqual(metadata('match'), ['https://www.bilibili.com/video/*']);
  assert.deepEqual(metadata('grant'), ['none']);
  assert.deepEqual(metadata('sandbox'), ['raw']);
  assert.deepEqual(metadata('require'), []);
  assert.deepEqual(metadata('connect'), []);
  assert.equal(script.includes('BILI_WEBFULL_'), false);
});
