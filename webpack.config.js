import { URL } from 'url';
export default {
  entry: {
    navbar: './index.js',
  },
  output: {
    filename: 'lucos_navbar.js',
    path: new URL('.', import.meta.url).pathname,
  },
  mode: 'production',
};