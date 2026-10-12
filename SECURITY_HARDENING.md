# Security hardening

## Threat model

The local relay is sensitive because the official OpenAI extension host treats a connection carrying the official Chrome extension origin as privileged. A hostile website, local process, or unrelated extension must not be able to use the compatibility bridge as an origin-confusion proxy.

The fork assumes the local operating-system account, installed Zen binary, official OpenAI host, and inherited OpenAI extension assets are trusted. It does not try to defend a compromised user account or kernel.

## Implemented controls

### Authenticated loopback relay

At startup the native bridge reads 32 random bytes from `/dev/urandom` on Unix or `BCryptGenRandom` on Windows. It embeds the hex-encoded capability into every WebSocket URL returned to the extension. A new value is generated for every process.

The relay reads and validates the HTTP upgrade before opening an upstream connection. It requires:

- a loopback TCP peer;
- the exact secret route using a constant-time comparison;
- a syntactically valid `moz-extension://` origin;
- `GET` over HTTP/1.1;
- a complete WebSocket upgrade;
- headers no larger than 64 KiB and completion within five seconds.

Only after those checks does the relay connect to the official host and substitute the official Chrome origin. Failed authentication receives HTTP 403 and cannot reach the upstream port.

### Extension and host isolation

The fork uses Gecko UUID `{2ed87dbc-332c-4f85-9655-bd6e7b932d43}` and native host `com.simonrendon.zen_browser_use_secure`. The compatibility shim maps the name expected by the inherited bundle to this host. Native manifests allow only the fork UUID.

### Page binding validation

The content bridge accepts `postMessage` traffic only from the same window and origin. Binding messages require bounded strings. The background accepts a binding event only when its sender is this extension, its tab has an active debugger session, and its name is currently registered for that tab. Payloads are limited to 1 MiB.

### File and message limits

Native input and output sizes are bounded. Upload enrichment accounts for base64 expansion before reading file contents. Unix opens use `O_NONBLOCK | O_NOFOLLOW` and require regular files, reducing device and FIFO hangs and symbolic-link replacement attacks.

### Release integrity

The release workflow requires Windows and Apple signing credentials, verifies Authenticode and Apple signatures, submits the macOS package for notarization, staples the ticket, and checks it with `pkgutil` and Gatekeeper. Extension distribution still requires Mozilla signing. Checksums accompany native artifacts.

## Verification performed

- Rust unit suite covering relay capabilities, origins, handshakes, file races, and size limits.
- JavaScript compatibility and native protocol suites.
- Installer library tests.
- Full native integration through the compiled bridge and local fixture.
- Disposable-profile live test using Zen under a strict Content Security Policy.

## Remaining trust boundaries

- The inherited OpenAI bundles are minified proprietary artifacts and were not rebuilt from source.
- The bridge intentionally launches and delegates to the official local OpenAI extension host.
- A process running as the same user may be able to inspect another process or its traffic depending on operating-system controls. The random capability prevents blind access to the relay but is not a sandbox boundary against a fully compromised account.
- Local development installation uses an ad hoc macOS signature. Public artifacts must use the signed and notarized release workflow.
