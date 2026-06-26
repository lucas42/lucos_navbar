/**
 * Session keepalive for lucos human users (ADR-0003 §2, navbar side).
 *
 * When initKeepalive(aithneOrigin) is called, this module:
 *
 * 1. Fires a credentialed POST to <aithneOrigin>/auth/remint every 10 minutes —
 *    well under the 15-minute aithne_session TTL. The timer runs regardless of
 *    whether the tab is visible or backgrounded.
 * 2. Also fires immediately on focus and visibilitychange→visible events to close
 *    the wake-from-sleep race (timer didn't fire while the laptop was sleeping).
 * 3. Coordinates across same-origin tabs via BroadcastChannel('lucos_session'):
 *    when one tab re-mints it broadcasts the timestamp; others reset their countdown.
 *    This produces ~one refresh per interval across N open tabs, not N refreshes.
 * 4. Retries failed remints after 1 minute. With a 15-minute TTL and a 10-minute
 *    normal interval, a single transient error would otherwise exhaust the TTL before
 *    the next scheduled attempt. The 1-minute retry gives 4–5 attempts within the window.
 * 5. Reports session health to the status indicator via BroadcastChannel('lucos_status'):
 *    posts 'session-active' on a successful remint, 'session-expired' on any failure,
 *    so the lucos-status-indicator can show an orange dot when the session is lost.
 *
 * The aithne origin is NOT hardcoded; it is passed in by the consumer via the
 * lucos-navbar aithne-origin attribute (varies per environment).
 */

const INTERVAL_MS = 10 * 60 * 1000; // 10 min — safely below the 15-min access-token TTL
const RETRY_DELAY_MS = 60 * 1000;    // 1 min retry after failure — gives 4+ attempts in the TTL window

let remintUrl = null;
let lastRefreshedAt = 0;
let keepaliveTimer = null;
let retryTimer = null;
let sessionChannel = null;
let statusChannel = null;
let initialized = false;

function isRefreshDue() {
	return Date.now() - lastRefreshedAt > INTERVAL_MS;
}

/**
 * Schedule a remint attempt one minute after a failure.
 * No-op if a retry is already pending (idempotent).
 */
function scheduleRetry() {
	if (retryTimer !== null) return; // already pending
	retryTimer = setTimeout(() => {
		retryTimer = null;
		tryRemint();
	}, RETRY_DELAY_MS);
}

/**
 * Attempt a silent re-mint. No-op if:
 *  - the keepalive has not been configured (no aithne-origin attribute), or
 *  - a refresh is not yet due (another tab refreshed recently).
 *
 * Optimistically claims the refresh slot by setting lastRefreshedAt and
 * broadcasting before the fetch, so concurrent tabs that also see isRefreshDue()
 * skip their own request. On fetch failure the timestamp is reset to allow retry,
 * and a 1-minute retry is scheduled.
 */
async function tryRemint() {
	if (!remintUrl || !isRefreshDue()) return;

	// Optimistic claim: prevent concurrent tabs from also fetching.
	const now = Date.now();
	lastRefreshedAt = now;
	sessionChannel.postMessage({ type: 'session-refreshing', timestamp: now });

	try {
		const resp = await fetch(remintUrl, {
			method: 'POST',
			credentials: 'include',
		});
		if (!resp.ok) {
			// Endpoint returned an error (e.g. 401 expired IdP session, 503 transient).
			// Reset so the next event triggers another attempt, and schedule a retry.
			lastRefreshedAt = 0;
			console.warn(`lucos_navbar: session keepalive returned ${resp.status}`);
			statusChannel.postMessage('session-expired');
			scheduleRetry();
		} else {
			statusChannel.postMessage('session-active');
		}
	} catch (err) {
		lastRefreshedAt = 0; // network error — allow retry
		console.warn('lucos_navbar: session keepalive fetch failed:', err);
		statusChannel.postMessage('session-expired');
		scheduleRetry();
	}
}

function startTimer() {
	if (keepaliveTimer !== null) return; // already running
	keepaliveTimer = setInterval(() => {
		tryRemint();
	}, INTERVAL_MS);
}

/**
 * Initialise the session keepalive.
 * Called by the Navbar custom element when its aithne-origin attribute is set.
 * Safe to call multiple times — only the first call takes effect.
 *
 * @param {string} aithneOrigin - The base URL of the aithne service
 *   (e.g. "https://aithne.l42.eu"). MUST NOT be hardcoded by this module.
 */
export function initKeepalive(aithneOrigin) {
	if (initialized) return;
	initialized = true;

	remintUrl = `${aithneOrigin}/auth/remint`;

	// BroadcastChannel is same-origin by spec — no cross-origin leakage.
	// Created here (not at module load) so tests can stub globalThis.BroadcastChannel first.
	sessionChannel = new BroadcastChannel('lucos_session');
	statusChannel = new BroadcastChannel('lucos_status');
	sessionChannel.addEventListener('message', (event) => {
		// Another tab has claimed the next refresh slot (optimistic broadcast,
		// sent before the fetch). Update our timestamp so we skip our own fetch
		// until the full interval has elapsed again.
		if (event.data?.type === 'session-refreshing') {
			lastRefreshedAt = event.data.timestamp;
		}
	});

	// Fire an immediate check when returning to visibility — catches the wake-from-sleep
	// gap where the timer did not fire while the machine was sleeping.
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			tryRemint();
		}
	});

	// Fire on window focus to catch wake-from-sleep when the tab was already visible
	// but the machine was sleeping (visibilitychange does not always fire in that case).
	window.addEventListener('focus', () => tryRemint());

	// Start the timer — runs regardless of tab visibility.
	startTimer();
}

/**
 * Reset all module-level state. For use in unit tests only — not exported for
 * production use.
 */
export function _resetForTest() {
	if (sessionChannel) { sessionChannel.close(); sessionChannel = null; }
	if (statusChannel) { statusChannel.close(); statusChannel = null; }
	if (keepaliveTimer !== null) { clearInterval(keepaliveTimer); keepaliveTimer = null; }
	if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
	remintUrl = null;
	lastRefreshedAt = 0;
	initialized = false;
}

/**
 * Directly invoke tryRemint(). For use in unit tests only — lets tests exercise
 * the fetch/retry logic without waiting for the setInterval tick.
 */
export async function _tryRemintForTest() {
	return tryRemint();
}
