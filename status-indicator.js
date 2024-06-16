class StatusIndicator extends HTMLElement {
	constructor() {
		// Always call super first in constructor
		super();
		const component = this;
		const shadow = this.attachShadow({mode: 'closed'});

		const staticStyle = document.createElement('style');    // Size & postion attributes present all the time, to avoid things moving around when the status changes
		const dynamicStyle = document.createElement('style');   // Attributes which vary based on the current status
		const animationStyle = document.createElement('style'); // Attributes used when the indicator is animated

		staticStyle.textContent = `
		:host {
			display: block;
			padding: 11px;
			margin: 3px;
			border: inset 1px transparent;
			border-radius: 25px;
		}
		`;
		shadow.appendChild(staticStyle);
		shadow.appendChild(dynamicStyle);
		shadow.appendChild(animationStyle);

		let streamingState;
		let serviceWorkerState;
		const statusChannel = new BroadcastChannel("lucos_status");
		statusChannel.addEventListener('message', event => {
			if (event.data.startsWith('streaming-')) {
				streamingState = event.data.replace('streaming-','');
			}
			if (event.data.startsWith('service-worker-')) {
				serviceWorkerState = event.data.replace('service-worker-','');
			}
			const serviceWorkerWaiting = (component.getAttribute("service-worker") === "waiting");
			let iconColour;
			let cursor = "default";
			let title;

			// If the service worker is no longer in waiting mode, remove the refreshing animation
			// This is rarely the case, as most apps do a full refresh of the page after SW waiting has been skipped
			if (serviceWorkerState !== 'waiting') {
				animationStyle.textContent = '';
			}
			if (!streamingState && serviceWorkerState !== 'waiting') {
				dynamicStyle.textContent = '';
				component.removeAttribute("title");
				return;
			}
			if (serviceWorkerState === 'waiting') {
				iconColour = "blue";
				cursor = "pointer";
				title = "New Version Available";
			} else if (streamingState === "opened") {
				iconColour = "green";
				title = "Connected";
			} else if (streamingState === "closed") {
				iconColour = "red";
				title = "Disconnected";
			} else {
				iconColour = "white";
				title = "Unknown Status: "+component.getAttribute("streaming");
			}
			component.setAttribute("title", title);
			dynamicStyle.textContent = `
			:host {
				background-color: ${iconColour};
				background-image: linear-gradient(rgba(255, 255, 255, 0.7) 15%, transparent 80%, transparent 85%, rgba(0, 0, 0, 0.2) 95%, transparent 100%);
				border-color: ${iconColour};
				cursor: ${cursor};
			}
			`;
		});
		component.addEventListener("click", function () {
			// When clicked in the waiting state, spin the indicator and fire a skip waiting event
			if (serviceWorkerState === "waiting") {
				animationStyle.textContent = `
				:host  {
					animation: spin 1.25s linear infinite running;
				}

				@keyframes spin {
					from { transform:rotate(0deg); }
					to { transform:rotate(360deg); }
				}
				`;
				statusChannel.postMessage("service-worker-skip-waiting");
			}
		});
	}
}
customElements.define('lucos-status-indicator', StatusIndicator);