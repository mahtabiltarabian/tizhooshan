// CSS modules in the app's screen files, as the server sees them (src/ignore-css.ts).
module.exports = new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) });
