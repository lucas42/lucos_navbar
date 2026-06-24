/**
 * Unit tests for status-indicator.js
 *
 * StatusIndicator is a Web Component (extends HTMLElement) that uses browser-only
 * APIs. All required globals are stubbed before the dynamic import so that
 * HTMLElement is in scope when the class body is evaluated (class definition
 * time, not instantiation time).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// ── Browser global stubs ──────────────────────────────────────────────────────
// These MUST be set before the dynamic import below — `class StatusIndicator
// extends HTMLElement` reads globalThis.HTMLElement at class-definition time.

let activeChannel;

globalThis.BroadcastChannel = function MockBroadcastChannel() {
	const listeners = {};
	const posted = [];
	activeChannel = {
		addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
		postMessage(msg) { posted.push(msg); },
		/** All messages posted outbound by the indicator. */
		get posted() { return posted; },
		/** Simulate an inbound message from the app. */
		_dispatch(data) { (listeners['message'] ?? []).forEach(fn => fn({ data })); },
	};
	return activeChannel;
};

globalThis.CSSStyleSheet = class {
	replaceSync(css) { this._css = css; }
};

const _registeredElements = {};
globalThis.customElements = {
	define(name, cls) { _registeredElements[name] = cls; },
};

globalThis.HTMLElement = class {
	attachShadow() {
		this._shadow = { adoptedStyleSheets: [] };
		return this._shadow;
	}
	getAttribute(name) { return (this._attrs ?? {})[name] ?? null; }
	setAttribute(name, value) {
		if (!this._attrs) this._attrs = {};
		this._attrs[name] = value;
	}
	removeAttribute(name) {
		if (!this._attrs) this._attrs = {};
		delete this._attrs[name];
	}
	addEventListener(type, fn) {
		if (!this._listeners) this._listeners = {};
		if (!this._listeners[type]) this._listeners[type] = [];
		this._listeners[type].push(fn);
	}
	/** Simulate a click event on the element. */
	_click() { (this._listeners?.click ?? []).forEach(fn => fn()); }
};

// Dynamic import runs AFTER all globalThis assignments above are in place,
// so HTMLElement is defined when `class StatusIndicator extends HTMLElement` executes.
await import('./status-indicator.js');
const StatusIndicator = _registeredElements['lucos-status-indicator'];

// ── Test helpers ──────────────────────────────────────────────────────────────

/**
 * Create a fresh indicator instance with its own BroadcastChannel.
 * Returns helpers to send messages and read current visual state.
 */
function makeIndicator() {
	const el = new StatusIndicator();
	const channel = activeChannel; // captured immediately: set during the constructor's `new BroadcastChannel()`
	// Constructor creates sheets in order: [staticSheet, dynamicSheet, animationSheet]
	const dynamicSheet = el._shadow.adoptedStyleSheets[1];
	return {
		/** Send an inbound BroadcastChannel message (as the app would). */
		send(msg) { channel._dispatch(msg); },
		/** Current title attribute value, or null if not set. */
		title() { return el.getAttribute('title'); },
		/** Current CSS on the dynamic stylesheet (undefined if no message received yet). */
		dynamicCSS() { return dynamicSheet._css; },
		/** Messages posted outbound by the indicator (e.g. skip-waiting). */
		posted() { return channel.posted; },
		/** Simulate a user clicking the indicator. */
		click() { el._click(); },
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('session-expired message shows orange indicator with "Session expired" tooltip', () => {
	const ind = makeIndicator();
	ind.send('session-expired');
	assert.ok(ind.dynamicCSS().includes('background-color: orange'), 'background is orange');
	assert.equal(ind.title(), 'Session expired');
});

test('session-active clears the session-expired state when no stream is open', () => {
	const ind = makeIndicator();
	ind.send('session-expired');
	ind.send('session-active');
	assert.equal(ind.dynamicCSS(), '', 'dynamic CSS cleared');
	assert.equal(ind.title(), null, 'title attribute removed');
});

test('session-active with stream open reverts to connected (green)', () => {
	const ind = makeIndicator();
	ind.send('streaming-opened');
	ind.send('session-expired');
	assert.ok(ind.dynamicCSS().includes('background-color: orange'), 'orange while session expired');
	ind.send('session-active');
	assert.ok(ind.dynamicCSS().includes('background-color: green'), 'reverts to green after session-active');
	assert.equal(ind.title(), 'Connected');
});

test('service-worker-waiting overrides session-expired — blue takes priority', () => {
	const ind = makeIndicator();
	ind.send('session-expired');
	ind.send('service-worker-waiting');
	assert.ok(ind.dynamicCSS().includes('background-color: blue'), 'blue overrides orange');
	assert.equal(ind.title(), 'New Version Available');
});

test('session-expired overrides stream disconnected — orange outranks red', () => {
	const ind = makeIndicator();
	ind.send('streaming-closed');
	ind.send('session-expired');
	assert.ok(ind.dynamicCSS().includes('background-color: orange'), 'orange overrides red');
	assert.equal(ind.title(), 'Session expired');
});

test('session-expired is shown even when no stream state is set', () => {
	const ind = makeIndicator();
	ind.send('session-expired');
	assert.notEqual(ind.dynamicCSS(), '', 'indicator is not hidden');
	assert.ok(ind.dynamicCSS().includes('background-color: orange'));
});

test('clicking the orange indicator posts nothing to the channel', () => {
	const ind = makeIndicator();
	ind.send('session-expired');
	ind.click();
	assert.equal(ind.posted().length, 0, 'no postMessage on click in orange state');
});

test('streaming-opened shows green (Connected) indicator', () => {
	const ind = makeIndicator();
	ind.send('streaming-opened');
	assert.ok(ind.dynamicCSS().includes('background-color: green'));
	assert.equal(ind.title(), 'Connected');
});

test('streaming-closed shows red (Disconnected) indicator', () => {
	const ind = makeIndicator();
	ind.send('streaming-closed');
	assert.ok(ind.dynamicCSS().includes('background-color: red'));
	assert.equal(ind.title(), 'Disconnected');
});

test('service-worker-waiting shows blue (New Version Available) indicator', () => {
	const ind = makeIndicator();
	ind.send('service-worker-waiting');
	assert.ok(ind.dynamicCSS().includes('background-color: blue'));
	assert.equal(ind.title(), 'New Version Available');
});

test('no messages: indicator stays in initial state with no visual output', () => {
	const ind = makeIndicator();
	assert.equal(ind.dynamicCSS(), undefined, 'dynamic CSS untouched');
	assert.equal(ind.title(), null, 'no title attribute');
});
