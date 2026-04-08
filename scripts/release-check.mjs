import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function tryRunGit(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

function fail(message) {
  console.error(`release-check: ${message}`);
  process.exit(1);
}

const requireTag = process.argv.includes("--require-tag");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const version = String(packageJson.version ?? "").trim();

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  fail(`package.json version is not strict semver: "${version}"`);
}

const dirty = runGit(["status", "--porcelain", "--untracked-files=all"]);
if (dirty) {
  fail("git working tree is not clean");
}

if (!changelog.includes("## [Unreleased]")) {
  fail("CHANGELOG.md is missing an [Unreleased] section");
}

if (!changelog.includes(`## [${version}]`)) {
  fail(`CHANGELOG.md is missing section for version ${version}`);
}

const branch = runGit(["branch", "--show-current"]);
const expectedTag = `v${version}`;
const exactTag = tryRunGit(["describe", "--tags", "--exact-match", "HEAD"]);

if (requireTag) {
  if (!exactTag) {
    fail(`HEAD is not tagged; expected ${expectedTag}`);
  }
  if (exactTag !== expectedTag) {
    fail(`HEAD tag ${exactTag} does not match package version ${expectedTag}`);
  }
}

console.log(`release-check: OK`);
console.log(`  branch: ${branch}`);
console.log(`  version: ${version}`);
console.log(`  exactTag: ${exactTag || "(none)"}`);
console.log(`  requireTag: ${requireTag ? "yes" : "no"}`);
