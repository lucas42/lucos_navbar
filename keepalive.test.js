/**
 * Unit tests for keepalive.js.
 *
 * The module is a pure browser module (uses BroadcastChannel, document, window,
 * fetch). All browser globals are stubbed before initKeepalive() is called.
 * _resetForTest() is called between tests to reset module-level state.
 */

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initKeepalive, _resetForTest, _tryRemintForTest } from './keepalive.js';

// ── Browser global stubs ──────────────────────────────────────────────────────
// These are assigned once at module load. keepalive.js only reads these globals
// inside initKeepalive() or tryRemint() — never at import time — so order is safe.

let mockChannel;
let docListeners;
let isHidden;

globalThis.BroadcastChannel = function MockBroadcastChannel() {
	const listeners = {};
	mockChannel = {
		addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
		postMessage: mock.fn(),
		close: mock.fn(),
		/** Simulate an incoming message from another tab. */
		_dispatch(data) { (listeners['message'] ?? []).forEach(fn => fn({ data })); },
	};
	return mockChannel;
};

globalThis.document = {
	get hidden() { return isHidden; },
	addEventListener(type, fn) { (docListeners[type] ??= []).push(fn); },
	/** Simulate a DOM event (e.g. 'visibilitychange', 'submit'). */
	_dispatch(type, event = {}) { (docListeners[type] ?? []).forEach(fn => fn(event)); },
};

globalThis.window = { addEventListener: mock.fn() };

// ── Per-test setup ────────────────────────────────────────────────────────────

beforeEach(() => {
	isHidden = false;
	docListeners = {};
	mockChannel = null;
	mock.reset(); // clear call counts on all mocks
	_resetForTest();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test('tryRemint POSTs to <aithneOrigin>/auth/remint with credentials', async () => {
	initKeepalive('https://aithne.l42.eu');
	const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	await _tryRemintForTest();

	assert.equal(fetchMock.mock.calls.length, 1, 'fetch called once');
	const [url, opts] = fetchMock.mock.calls[0].arguments;
	assert.equal(url, 'https://aithne.l42.eu/auth/remint');
	assert.equal(opts.method, 'POST');
	assert.equal(opts.credentials, 'include');
});

test('successful remint does not schedule a retry', async (t) => {
	initKeepalive('https://aithne.l42.eu');
	mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	// Spy on setTimeout — wrap without replacing, so we can inspect call args
	const setTimeoutSpy = t.mock.method(globalThis, 'setTimeout');

	await _tryRemintForTest();

	const retryScheduled = setTimeoutSpy.mock.calls.some(c => c.arguments[1] === 60 * 1000);
	assert.equal(retryScheduled, false, 'no 1-minute retry scheduled after success');
});

test('non-OK response schedules a 1-minute retry', async (t) => {
	initKeepalive('https://aithne.l42.eu');
	mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));

	const setTimeoutSpy = t.mock.method(globalThis, 'setTimeout');

	await _tryRemintForTest();

	const retryCalls = setTimeoutSpy.mock.calls.filter(c => c.arguments[1] === 60 * 1000);
	assert.equal(retryCalls.length, 1, 'setTimeout called once with 1-minute delay');
});

test('network error schedules a 1-minute retry', async (t) => {
	initKeepalive('https://aithne.l42.eu');
	mock.method(globalThis, 'fetch', async () => { throw new Error('NetworkError'); });

	const setTimeoutSpy = t.mock.method(globalThis, 'setTimeout');

	await _tryRemintForTest();

	const retryCalls = setTimeoutSpy.mock.calls.filter(c => c.arguments[1] === 60 * 1000);
	assert.equal(retryCalls.length, 1, 'setTimeout called once with 1-minute delay');
});

test('second failure with a pending retry does not stack another timeout', async (t) => {
	// scheduleRetry() is idempotent — retryTimer !== null prevents a second setTimeout
	initKeepalive('https://aithne.l42.eu');
	mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));

	const setTimeoutSpy = t.mock.method(globalThis, 'setTimeout');

	// First failure — schedules a retry
	await _tryRemintForTest();
	// Second failure before the retry fires — should NOT schedule another
	await _tryRemintForTest();

	const retryCalls = setTimeoutSpy.mock.calls.filter(c => c.arguments[1] === 60 * 1000);
	assert.equal(retryCalls.length, 1, 'only one retry scheduled despite two failures');
});

test('BroadcastChannel message from another tab prevents redundant fetch', async () => {
	initKeepalive('https://aithne.l42.eu');
	const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	// Simulate another tab refreshing right now
	mockChannel._dispatch({ type: 'session-refreshed', timestamp: Date.now() });

	await _tryRemintForTest();

	assert.equal(fetchMock.mock.calls.length, 0, 'fetch skipped — another tab just refreshed');
});

test('BroadcastChannel message with old timestamp still allows fetch', async () => {
	initKeepalive('https://aithne.l42.eu');
	const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	// Simulate another tab refreshing 11 minutes ago (beyond the 10-minute interval)
	const elevenMinutesAgo = Date.now() - 11 * 60 * 1000;
	mockChannel._dispatch({ type: 'session-refreshed', timestamp: elevenMinutesAgo });

	await _tryRemintForTest();

	assert.equal(fetchMock.mock.calls.length, 1, 'fetch fires when last refresh was > 10 min ago');
});

test('tryRemint is a no-op before initKeepalive is called', async () => {
	// _resetForTest was called in beforeEach — module is in clean uninitialised state
	const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	await _tryRemintForTest();

	assert.equal(fetchMock.mock.calls.length, 0, 'no fetch before initKeepalive');
});

test('initKeepalive is idempotent — second call with a different origin is ignored', async () => {
	initKeepalive('https://aithne.l42.eu');
	initKeepalive('https://other-aithne.example.com'); // second call must be a no-op

	const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true }));
	await _tryRemintForTest();

	assert.equal(fetchMock.mock.calls.length, 1);
	const [url] = fetchMock.mock.calls[0].arguments;
	assert.equal(url, 'https://aithne.l42.eu/auth/remint', 'first origin wins');
});

test('visibilitychange to visible triggers an immediate tryRemint', async () => {
	isHidden = true; // start hidden — initKeepalive will not start the timer
	initKeepalive('https://aithne.l42.eu');
	const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	// Tab becomes visible
	isHidden = false;
	document._dispatch('visibilitychange');
	await Promise.resolve(); // flush the tryRemint microtask

	assert.equal(fetchMock.mock.calls.length, 1, 'fetch fires on visibilitychange to visible');
});

test('BroadcastChannel postMessage is called on a successful remint', async () => {
	initKeepalive('https://aithne.l42.eu');
	mock.method(globalThis, 'fetch', async () => ({ ok: true }));

	await _tryRemintForTest();

	assert.equal(mockChannel.postMessage.mock.calls.length, 1, 'BroadcastChannel notified');
	const [msg] = mockChannel.postMessage.mock.calls[0].arguments;
	assert.equal(msg.type, 'session-refreshed');
	assert.ok(typeof msg.timestamp === 'number', 'timestamp is a number');
});
