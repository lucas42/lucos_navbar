# lucos-navbar
Web Component containing navigation bar for lucos apps


## Technologies used
* ES Modules
* Web Components

## Installation & Usage
There's currently two ways to include lucos-navbar - as an npm package or a docker image.

Regardless of installation method, also include the following element at the top of the `<body>` tag in your html:
```
<lucos-navbar>Title to appear in navbar</lucos-navbar>
```

### NPM Package
Run the following command:

```
	npm i lucos_navbar
```

Then include the following in your javascript:
```
import 'lucos_navbar';
```
### Docker Image
Update the Dockerfile to include:

```
## Near top of file:
FROM lucas42/lucos_navbar:latest as navbar

## After `WORKDIR` has been set:
COPY --from=navbar lucos_navbar.js .
```

Ensure the file is served by the webserver and then include the following at the end of the `<body>` tag in your html:
```
<script src="/lucos_navbar.js" type="text/javascript"></script>
```

### Attributes to the navbar
The navigation bar will function without any attributes.  The following attributes can be added as optional:

* `device` (deprecated) - set to "cast-receiver" to tweak the style so it suits big screens with lower resolution
* `font` set to a valid `font-family` CSS value to apply to the title.  If set, font size is automatically increased.
* `text-colour` any valid CSS colour value for the text in the navbar.  Defaults to white.
* `bg-colour` any valid CSS colour value for the background of the navbar.  Defaults to black.  A gradient is applied on top of the given colour.
* `streaming` the status of any streaming connection with the server (eg web socket or long polling).  Recognised values are "active" or "stopped".  Sets a status indicator on the right on the navbar.
* `service-worker` the status of any service worker serving the app.  Only recognised value is "waiting", which will set the status indicator and makes it clickable, which'll send a message "service-worker-skip-waiting" to the Broadcast Channel `lucos_status`.  This takes precedant over `streaming` attribute for setting status indicator.

## Manual Testing
Run:
```
npm run example
```
This uses webpack to build the javascript and then opens a html page which includes the web component

## Automated Testing
Not yet available

## Publish to npm
Automatically publishes on the `main` branch when pushed to github.

Make sure to bump the version number in package.json. (Can use `npm version ${version_number}`).


## Publish to dockerhub
Automatically publishes on the `main` branch when pushed to github.

Creates a docker image containing a single file called `lucos_navbar.js` which can be included in other projects which don't use npm