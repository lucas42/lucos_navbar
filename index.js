import initTimeComponent from 'lucos_time_component';
import Logo from './assets/lucos-logo.png';
import './status-indicator.js';

class Navbar extends HTMLElement {
	static get observedAttributes() {
		return ['font','text-colour','bg-colour'];
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
		
		const titleNode = document.createElement('span');
		while (this.firstChild) titleNode.appendChild(this.firstChild);
		titleNode.id='lucos_navbar_title';
		navbar.appendChild(titleNode);
		
		navbar.appendChild(document.createElement('lucos-time'));

		navbar.appendChild(document.createElement('lucos-status-indicator'));
		
		// Swallow any clicks on the navbar to stop pages handling them
		navbar.addEventListener("click", function _stopnavbarpropagation(event) { event.stopPropagation(); }, false);

		const mainStyle = document.createElement('style');   // Primary stylesheet for the navbar
		const titleStyle = document.createElement('style');  // Title-specific overrides
		const colourStyle = document.createElement('style'); // Colour-specific overrides

		mainStyle.textContent = `

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
		`;

		/**
		 * Allow specific sites to use a custom font for the title
		 */
		component.updateTitleFont = () => {
			if(!component.getAttribute("font")) {
				titleStyle.textContent = '';
			} else {
				titleStyle.textContent = `
				#lucos_navbar_title {
					font-size: 40px;
					font-family: ${component.getAttribute("font")};
				}
				`;
			}
		};

		/**
		 * Allow specific sites to use a custom colour for the navbar
		 */
		component.updateColour = () => {
			const textColour = component.getAttribute("text-colour") || 'white';
			const bgColour = component.getAttribute("bg-colour") || 'black';
			colourStyle.textContent = `
			:host {
				color: ${textColour};
				background-color: ${bgColour};
				background-image: linear-gradient(rgba(255, 255, 255, 0.4) 10%, transparent 85%, transparent 100%)
			}
			`;
		};

		shadow.appendChild(mainStyle);
		shadow.appendChild(titleStyle);
		shadow.appendChild(colourStyle);
		addGlobalStyle();
		component.updateTitleFont();
		component.updateColour();

		shadow.appendChild(navbar);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		switch (name) {
			case "font":
				this.updateTitleFont();
				break;
			case "text-colour":
			case "bg-colour":
				this.updateColour();
				break;
		}
	}
}

let globalStyleAdded = false;
function addGlobalStyle() {
	// Only load global style once
	if (globalStyleAdded) return;
	const globalStyle = document.createElement('style');
	globalStyle.textContent = `
		body {
			padding-top: 30px;
		}
	`;

	// Prepend the global style, so individual pages can easily override
	document.head.prepend(globalStyle);
	globalStyleAdded = true;
}

initTimeComponent();
customElements.define('lucos-navbar', Navbar);
