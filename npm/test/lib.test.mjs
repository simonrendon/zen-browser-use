import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  checksumAsset,
  downloadWithRetry,
  expectedChecksum,
  installLocations,
  isInstalledBridgeBinary,
  manifestPaths,
  nativeManifest,
  optionalManifestPaths,
  platformAsset
} from "../lib.mjs";

test("selects release assets for every supported platform", () => {
  assert.equal(
    platformAsset("1.4.0", "win32", "x64"),
    "codex-firefox-bridge-1.4.0-windows-x64.exe"
  );
  assert.equal(
    platformAsset("1.4.0", "darwin", "arm64"),
    "codex-firefox-bridge-1.4.0-macos-universal"
  );
  assert.equal(
    platformAsset("1.4.0", "darwin", "x64"),
    "codex-firefox-bridge-1.4.0-macos-universal"
  );
  assert.equal(
    checksumAsset("1.4.0", "darwin"),
    "codex-firefox-bridge-1.4.0-macos-universal.sha256"
  );
  assert.equal(
    platformAsset("1.4.0", "linux", "x64"),
    "codex-firefox-bridge-1.4.0-linux-x64"
  );
  assert.equal(
    checksumAsset("1.4.0", "linux"),
    "codex-firefox-bridge-1.4.0-linux-x64.sha256"
  );
  assert.throws(
    () => platformAsset("1.4.0", "linux", "arm64"),
    /Unsupported platform: linux\/arm64/u
  );
});

test("extracts the matching checksum from multi-file checksum lists", () => {
  const contents = [
    `${"a".repeat(64)}  installer.exe`,
    `${"b".repeat(64)}  codex-firefox-bridge-1.4.0-windows-x64.exe`
  ].join("\n");
  assert.equal(
    expectedChecksum(contents, "codex-firefox-bridge-1.4.0-windows-x64.exe"),
    "b".repeat(64)
  );
});

test("generates Firefox native-host manifests", () => {
  const manifest = nativeManifest("/tmp/bridge");
  assert.equal(manifest.name, "com.simonrendon.zen_browser_use_secure");
  assert.equal(manifest.path, "/tmp/bridge");
  assert.deepEqual(manifest.allowed_extensions, [
    "{2ed87dbc-332c-4f85-9655-bd6e7b932d43}"
  ]);
});

test("uses per-user installation locations", () => {
  const windows = installLocations(
    "win32",
    { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
    "/unused"
  );
  assert.equal(
    windows.directory,
    path.win32.join("C:\\Users\\test\\AppData\\Local", "Secure Browser Use for Zen")
  );
  const macos = installLocations("darwin", {}, "/Users/test");
  assert.equal(
    macos.manifest,
    "/Users/test/Library/Application Support/Mozilla/NativeMessagingHosts/com.simonrendon.zen_browser_use_secure.json"
  );
  assert.deepEqual(manifestPaths(macos), [macos.manifest]);
  assert.deepEqual(optionalManifestPaths(macos), []);
  const linux = installLocations("linux", {}, "/home/test");
  assert.equal(
    linux.directory,
    "/home/test/.local/share/Secure Browser Use for Zen"
  );
  assert.equal(
    linux.manifest,
    "/home/test/.mozilla/native-messaging-hosts/com.simonrendon.zen_browser_use_secure.json"
  );
  assert.deepEqual(manifestPaths(linux), [
    "/home/test/.mozilla/native-messaging-hosts/com.simonrendon.zen_browser_use_secure.json"
  ]);
  assert.deepEqual(optionalManifestPaths(linux), [
    "/home/test/.zen/native-messaging-hosts/com.simonrendon.zen_browser_use_secure.json"
  ]);
  const linuxXdg = installLocations(
    "linux",
    { XDG_DATA_HOME: "/home/test/.data" },
    "/home/test"
  );
  assert.equal(
    linuxXdg.directory,
    "/home/test/.data/Secure Browser Use for Zen"
  );
  assert.deepEqual(optionalManifestPaths(linuxXdg), [
    "/home/test/.zen/native-messaging-hosts/com.simonrendon.zen_browser_use_secure.json"
  ]);
});

test("retries transient release-download failures", async () => {
  let calls = 0;
  const value = await downloadWithRetry("https://example.test/bridge", {
    attempts: 3,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503 };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("bridge")
      };
    },
    sleep: async () => {}
  });
  assert.equal(value.toString("utf8"), "bridge");
  assert.equal(calls, 2);
});

test("retries release downloads after network errors", async () => {
  let calls = 0;
  const value = await downloadWithRetry("https://example.test/bridge", {
    attempts: 3,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError("fetch failed");
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("bridge")
      };
    },
    sleep: async () => {}
  });
  assert.equal(value.toString("utf8"), "bridge");
  assert.equal(calls, 2);
});

test("retries rate-limited release downloads", async () => {
  let calls = 0;
  const value = await downloadWithRetry("https://example.test/bridge", {
    attempts: 3,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 429 };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => Buffer.from("bridge")
      };
    },
    sleep: async () => {}
  });
  assert.equal(value.toString("utf8"), "bridge");
  assert.equal(calls, 2);
});

test("does not retry permanent release-download failures", async () => {
  let calls = 0;
  await assert.rejects(
    downloadWithRetry("https://example.test/missing", {
      attempts: 3,
      fetchImpl: async () => {
        calls += 1;
        return { ok: false, status: 404 };
      },
      sleep: async () => {}
    }),
    /Download failed \(404\)/u
  );
  assert.equal(calls, 1);
});

test("only identifies versioned bridge processes inside the install directory", () => {
  const directory = "C:\\Users\\test\\AppData\\Local\\Secure Browser Use for Zen";
  assert.equal(
    isInstalledBridgeBinary(
      `${directory}\\codex-firefox-bridge-1.4.1.exe`,
      directory,
      "win32"
    ),
    true
  );
  assert.equal(
    isInstalledBridgeBinary(
      `${directory}\\codex-firefox-bridge-1.4.6-beta.1.exe`,
      directory,
      "win32"
    ),
    true
  );
  assert.equal(
    isInstalledBridgeBinary(
      "C:\\Temp\\codex-firefox-bridge-1.4.1.exe",
      directory,
      "win32"
    ),
    false
  );
  assert.equal(
    isInstalledBridgeBinary(`${directory}\\unrelated.exe`, directory, "win32"),
    false
  );
});
