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
FROM lucas42/lucos_navbar:<<version_number>> as navbar

## After `WORKDIR` has been set:
COPY --from=navbar lucos_navbar.js .
```

Ensure the file is served by the webserver and then include the following at the end of the `<body>` tag in your html:
```
<script src="/lucos_navbar.js" type="text/javascript"></script>
```

### Attributes to the navbar
The navigation bar will function without any attributes.  The following attributes can be added as optional:

* `font` set to a valid `font-family` CSS value to apply to the title.  If set, font size is automatically increased.
* `title-padding` set to a valid `padding` CSS value to apply to the title.  Useful in combination with custom fonts which mightn't line up as expected.
* `text-colour` any valid CSS colour value for the text in the navbar.  Defaults to white.
* `bg-colour` any valid CSS colour value for the background of the navbar.  Defaults to black.  A gradient is applied on top of the given colour.

### Broadcast Channel Events
The status indicator interacts via a Broadcast Channel called `lucos_status`.

It listens to the following events:
* `streaming-opened` Indicates a streaming connection with the server (eg web socket or long polling) has started.  Status indicator turns green.
* `streaming-closed` Indicates a streaming connection with the server (eg web socket or long polling) has finished.  Status indicator turns red.
* `service-worker-waiting` Indicates a new service worker is available for use.  Status indicator turns blue.  This takes precedant over `streaming-*` events.
* `service-worker-active` Indicates a service worker has become active.  Removes the behaviours set by `service-worker-waiting`, including any animations on the status indicator.

It fires the following event:
* `service-worker-skip-waiting` Fired when the status indicator is in the `service-worker-waiting` state and receives a click event.  The status indicator also begins to spin when this is fired.  This signals that the user wants to switch to the new version.  It is addressed to the **page**, not the service worker: see [Handling service worker updates](#handling-service-worker-updates).

### Handling service worker updates
A page that reports `service-worker-waiting` must also handle the update itself:

1. **The page** listens for `service-worker-skip-waiting` on `lucos_status`, does any app-specific work that has to happen before the switch, then calls `registration.waiting?.postMessage('skip-waiting')`.
2. **The service worker** handles that with `self.addEventListener('message', …)`, calling `self.skipWaiting()` for `'skip-waiting'`, and calls `self.clients.claim()` in its `activate` handler.
3. **The page** reloads on `navigator.serviceWorker`'s `controllerchange` event, which also clears the spinning indicator.

Don't listen for `service-worker-skip-waiting` inside the service worker.  The browser may stop a waiting worker that has been idle, and a Broadcast Channel message doesn't start a stopped worker, so it never arrives and the indicator spins forever.  This was reproduced in Chromium for lucas42/lucos_notes#544; other browsers haven't been tested.  `postMessage` to the worker is the reliable route: the Service Worker spec starts the worker to deliver it.

The navbar doesn't post to the worker itself, because some apps need to finish work before the switch (lucos_media_seinn saves the current track's status first) and a direct post would race that.  lucos_media_seinn's `src/client/load-service-worker.js` and `src/service-worker/update.js` are the reference implementation.

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


## Publish to dockerhub
Automatically publishes on the `main` branch when pushed to github.

Creates a docker image containing a single file called `lucos_navbar.js` which can be included in other projects which don't use npm