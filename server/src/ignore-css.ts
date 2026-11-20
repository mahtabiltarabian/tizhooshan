// The server grades with the app's own tool adapters (src/tools/*/adapter.ts).
// Some reuse text helpers that live next to a tool's screen code, which
// imports CSS modules. Node cannot load CSS, the stylesheets are not copied
// into dist/, and the server never draws a screen: every .css import loads
// as an empty class map without looking for the file. Imported first in
// main.ts, before any adapter. (The tests do the same with Jest's
// moduleNameMapper.)

import { join } from "node:path";

interface ModuleInternals {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _extensions: Record<string, (m: { exports: unknown }) => void>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require("node:module") as ModuleInternals;
const resolve = Module._resolveFilename;
const styles = () => new Proxy({}, { get: (_, key) => (key === "__esModule" ? false : String(key)) });

Module._resolveFilename = function (this: unknown, request: string, ...rest: unknown[]) {
  if (request.endsWith(".css")) return join(__dirname, "__css__", request.replace(/[\\/:@]/g, "_"));
  return resolve.call(this, request, ...rest);
};
Module._extensions[".css"] = (m) => {
  m.exports = styles();
};
