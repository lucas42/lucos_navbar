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

## Manual Testing
Run:
```
npm run example
```
This uses webpack to build the javascript and then opens a html page which includes the web component

## Automated Testing
Not yet available

## Publish to npm
Make sure to bump the version number in package.json.

Then run `npm publish` (assuming you're already logged in)

## Publish to dockerhub
Happens automatically in circle when pushed to github.
Creates a docker image containing a single file called `lucos_navbar.js` which can be included in other projects which don't use npm