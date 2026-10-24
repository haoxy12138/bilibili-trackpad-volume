// ==UserScript==
// @name         Bilibili 网页全屏音量方向
// @namespace    local.bilibili.webfull.volume
// @version      1.0.3
// @description  网页全屏／全屏画面内反转原生滚动音量方向，触控板上推增加、下推减少。
// @author       haoxy12138
// @copyright    2026, haoxy12138
// @license      MIT
// @homepageURL  https://github.com/haoxy12138/bilibili-trackpad-volume
// @supportURL   https://github.com/haoxy12138/bilibili-trackpad-volume/issues
// @updateURL    https://raw.githubusercontent.com/haoxy12138/bilibili-trackpad-volume/main/bilibili-trackpad-volume.meta.js
// @downloadURL  https://raw.githubusercontent.com/haoxy12138/bilibili-trackpad-volume/main/bilibili-trackpad-volume.user.js
// @match        https://www.bilibili.com/video/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// @noframes
// ==/UserScript==

// SPDX-License-Identifier: MIT
(() => {
  'use strict';

  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const registry = new WeakMap();

  function scope(event) {
    const target = typeof event.target?.closest === 'function' ? event.target : null;
    const root = target?.closest('.bpx-player-container');
    if (!root || !target.closest('.bpx-player-video-area')) return null;
    if (target.closest('.bpx-player-control-wrap,input,textarea,select,[contenteditable="true"]')) {
      return null;
    }

    const body = document.body;
    const mode = root.getAttribute('data-screen');
    const fullscreen = mode === 'full' || mode === 'web' || mode === 'webfullscreen' ||
      body?.classList.contains('player-mode-webfullscreen') ||
      body?.classList.contains('player-mode-web');
    if (!fullscreen || event.ctrlKey || event.metaKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      return null;
    }

    return { root, mode };
  }

  function invoke(listener, receiver, event) {
    return typeof listener === 'function'
      ? Reflect.apply(listener, receiver, [event])
      : listener.handleEvent(event);
  }

  // Keep the player's own handlers. Only their view of vertical wheel values
  // changes, and only while the pointer is over a fullscreen video picture.
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (!['wheel', 'mousewheel'].includes(type) || !listener ||
        !['function', 'object'].includes(typeof listener)) {
      return Reflect.apply(add, this, arguments);
    }

    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    let entries = registry.get(listener);
    if (!entries) registry.set(listener, entries = []);
    let entry = entries.find(item =>
      item.target === this && item.type === type && item.capture === capture);

    if (!entry) {
      const target = this;
      const wrapper = function (event) {
        if (!scope(event)) return invoke(listener, this, event);

        const proxy = new Proxy(event, {
          get(original, key) {
            const value = Reflect.get(original, key, original);
            if (['deltaY', 'wheelDelta', 'wheelDeltaY'].includes(key) &&
                typeof value === 'number') {
              return -value;
            }
            // Native Event accessors/methods require the original receiver.
            return typeof value === 'function' ? value.bind(original) : value;
          },
        });

        return invoke(listener, this, proxy);
      };
      entries.push(entry = { target, type, capture, wrapper });
    }

    return Reflect.apply(add, this, [type, entry.wrapper, options]);
  };

  // Listener identity includes target, event type and capture. Reuse wrappers so
  // duplicate registration, removal, once and AbortSignal keep native behavior.
  EventTarget.prototype.removeEventListener = function (type, listener, options) {
    const capture = typeof options === 'boolean' ? options : Boolean(options?.capture);
    const entry = listener && registry.get(listener)?.find(item =>
      item.target === this && item.type === type && item.capture === capture);
    return Reflect.apply(remove, this, [type, entry?.wrapper || listener, options]);
  };
})();
