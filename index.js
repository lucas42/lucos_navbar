import initTimeComponent from 'lucos_time_component';
import Logo from './assets/lucos-logo.png';
import './status-indicator.js';
import { initKeepalive } from './keepalive.js';

class Navbar extends HTMLElement {
	static get observedAttributes() {
		return ['font','title-padding','text-colour','bg-colour','aithne-origin'];
	}
	constructor() {
		// Always call super first in constructor
		super();
		const component = this;
		const shadow = this.attachShadow({mode: 'closed'});
	
		const navbar = document.createElement('div');
		navbar.id="lucos_navbar";
		const homeimg = document.createElement('img');
		homeimg.src = Logo;
		homeimg.setAttribute("alt", "lucOS");
		homeimg.id = 'lucos_navbar_logo';
		const homeimglnk = document.createElement("a");
		homeimglnk.setAttribute("href", "https://l42.eu/");
		homeimglnk.appendChild(homeimg);
		navbar.appendChild(homeimglnk);

		const spacerNode = document.createElement('span');
		spacerNode.id='lucos_navbar_spacer';
		navbar.appendChild(spacerNode);
		
		const titleNode = document.createElement('h1');
		while (this.firstChild) titleNode.appendChild(this.firstChild);
		titleNode.id='lucos_navbar_title';
		navbar.appendChild(titleNode);
		
		navbar.appendChild(document.createElement('lucos-time'));

		navbar.appendChild(document.createElement('lucos-status-indicator'));
		
		// Swallow any clicks on the navbar to stop pages handling them
		navbar.addEventListener("click", function _stopnavbarpropagation(event) { event.stopPropagation(); }, false);

		const mainSheet = new CSSStyleSheet();   // Primary stylesheet for the navbar
		const titleSheet = new CSSStyleSheet();  // Title-specific overrides
		const colourSheet = new CSSStyleSheet(); // Colour-specific overrides

		mainSheet.replaceSync(`

		:host {
			z-index:1000;
			height: 100%;
			position: absolute;
			left: 0;
			right: 0;
			top: 0;
			height: 30px;
		}
		#lucos_navbar {
			font-size: 18px;
			font-family: Georgia, serif;
			height: 100%;
			display: flex;
			overflow: hidden;
		}
		#lucos_navbar_logo {
			height: 25px;
			padding: 2.5px 15px;
			width: 70px;
			cursor: pointer;
			border: none;
		}
		#lucos_navbar_title {
			text-align: center;
			line-height: 30px;
			font-weight: bold;
			height: 30px;
			text-overflow: ellipsis;
			white-space: nowrap;
			flex-grow: 1;
			min-width: 0;
			overflow: hidden;
			/* Reset default h1 browser styles so the navbar layout is unaffected */
			font-size: inherit;
			margin: 0;
			padding: 0;
		}
		lucos-time {
			font-family: "Courier New", Courier, monospace;
			margin: auto 10px;
			font-weight: bold;
			width: 90px;
			text-align: center;
		}

		/**
		 * Used so title is centred (100px logo width on left. 110px time + 30px status indicator width on right.  Needs 40px spacer)
		 * Using a large flex shrink, so if there's not enough space, this is the first element to get squeezed
		 */
		#lucos_navbar_spacer {
			width: 40px;
			flex-shrink: 9999;
		}
		a {
			color: inherit;
			text-decoration-line: none;
			text-decoration-style: dashed;
			text-decoration-thickness: 1px;
		}
		a:hover {
			text-decoration-line: underline overline;
		}
		`);

		/**
		 * Allow specific sites to use a custom font and/or padding for the title
		 */
		component.updateTitleStyle = () => {
			if(!component.getAttribute("font") && !component.getAttribute("title-padding")) {
				titleSheet.replaceSync('');
				return;
			}
			let newStyle = "#lucos_navbar_title {\n";
			if (component.getAttribute("font")) {
				newStyle += "\tfont-size: 40px;\n";
				newStyle += `\tfont-family: ${component.getAttribute("font")};\n`;
			}
			if (component.getAttribute("title-padding")) {
				newStyle += `\tpadding: ${component.getAttribute("title-padding")};\n`;
			}
			newStyle += "}\n";
			titleSheet.replaceSync(newStyle);
		};

		/**
		 * Allow specific sites to use a custom colour for the navbar
		 */
		component.updateColour = () => {
			const textColour = component.getAttribute("text-colour") || 'white';
			const bgColour = component.getAttribute("bg-colour") || 'black';
			colourSheet.replaceSync(`
			:host {
				color: ${textColour};
				background-color: ${bgColour};
				background-image: linear-gradient(rgba(255, 255, 255, 0.4) 10%, transparent 85%, transparent 100%)
			}
			`);
		};

		shadow.adoptedStyleSheets = [mainSheet, titleSheet, colourSheet];
		addGlobalStyle();
		component.updateTitleStyle();
		component.updateColour();

		shadow.appendChild(navbar);
	}

	connectedCallback() {
		// Start the keepalive if the aithne-origin attribute was already set
		// before the element was inserted into the DOM.
		const origin = this.getAttribute('aithne-origin');
		if (origin) initKeepalive(origin);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		switch (name) {
			case "font":
			case "title-padding":
				this.updateTitleStyle();
				break;
			case "text-colour":
			case "bg-colour":
				this.updateColour();
				break;
			case "aithne-origin":
				// Start the keepalive when the attribute is set dynamically.
				// initKeepalive is idempotent — repeated calls after the first are no-ops.
				if (newValue) initKeepalive(newValue);
				break;
		}
	}
}

let globalStyleAdded = false;
function addGlobalStyle() {
	// Only load global style once
	if (globalStyleAdded) return;
	const globalSheet = new CSSStyleSheet();
	globalSheet.replaceSync('body { padding-top: 30px; }');

	// adoptedStyleSheets are processed before <style> elements, so individual
	// pages can still override this with their own stylesheets.
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, globalSheet];
	globalStyleAdded = true;
}

initTimeComponent();
customElements.define('lucos-navbar', Navbar);
