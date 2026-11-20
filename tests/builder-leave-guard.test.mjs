// The website builder saves only when asked, so leaving it with unsaved changes must ask first. Every
// route change rebuilds the builder: Android back, links, the Store button, even reopening the screen.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const lf = text => text.split(String.fromCharCode(13, 10)).join("\n");
const main = lf(await readFile(new URL("../src/app/main.js", import.meta.url), "utf8"));
const builder = lf(await readFile(new URL("../src/screens/builder/builder.js", import.meta.url), "utf8"));

function routerHarness(guard) {
  const confirmBody = main.match(/\n  confirmRouteLeave\(nextRoute\) \{([\s\S]*?)\n  \},\n/)?.[1];
  const navigateBody = main.match(/\n  navigate\(path, openWorkspaceHome = false\) \{([\s\S]*?)\n  \},\n/)?.[1];
  assert.ok(confirmBody && navigateBody, "the router methods were found");
  const location = { hash: "#/account/web/site" };
  const window = { location, scrollTo() {} };
  const controller = {
    routeLeaveGuard: guard,
    handled: [],
    currentRoute() { return location.hash.slice(1); },
    handleRoute(path) { this.handled.push(path); },
    confirmRouteLeave: new Function("nextRoute", confirmBody),
    navigate: new Function("window", `return function (path, openWorkspaceHome = false) {${navigateBody}\n};`)(window)
  };
  return { controller, location };
}

test("leaving the builder asks its guard, and staying keeps the screen", () => {
  const asked = [];
  const { controller, location } = routerHarness(next => { asked.push(next); return false; });
  controller.navigate("/account/web/site");
  assert.deepEqual(asked, ["/account/web/site"], "re-showing the same screen would rebuild it, so it asks");
  assert.deepEqual(controller.handled, [], "and does not rebuild it when the owner stays");
  assert.equal(controller.confirmRouteLeave("/account/web"), false);
  controller.routeLeaveGuard = () => { throw new Error("frame gone"); };
  assert.equal(controller.confirmRouteLeave("/account/web"), true, "a broken check never traps the owner");
  controller.routeLeaveGuard = null;
  controller.navigate("/account/web");
  assert.equal(location.hash, "#/account/web");
});

test("a refused hash change puts the builder address back instead of leaving", () => {
  assert.match(main, /if \(next !== this\.lastHashRoute && !this\.confirmRouteLeave\(next\)\) \{\n\s*window\.history\.replaceState\(window\.history\.state, "", `#\$\{this\.lastHashRoute\}`\);\n\s*return;\n\s*\}/);
  assert.match(builder, /this\.routeLeaveGuard = \(\) => !litrusFrame\.isConnected \|\| !hasUnsavedChanges\(\) \|\|\n\s*window\.confirm\(/);
  assert.match(builder, /\} else \{\n\s*releaseLitrusLeaveGuard\.call\(this\);/, "other screens drop the guard");
  assert.match(builder, /export function unmount\(\) \{\n\s*releaseLitrusLeaveGuard\.call\(AppController\);/);
});
