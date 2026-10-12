#define AppVersion GetEnv("CODEX_FIREFOX_BRIDGE_VERSION")
#define BridgeBinary GetEnv("CODEX_FIREFOX_BRIDGE_BINARY")

[Setup]
AppId={{E862CE25-32C2-4F35-9475-84611ACCCB70}
AppName=Secure Browser Use for Zen
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Secure Browser Use for Zen
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
OutputBaseFilename=codex-firefox-bridge-{#AppVersion}-windows-x64-setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=Secure Browser Use for Zen

[Files]
Source: "{#BridgeBinary}"; DestDir: "{app}"; DestName: "zen-browser-use-secure-bridge.exe"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Mozilla\NativeMessagingHosts\com.simonrendon.zen_browser_use_secure"; ValueType: string; ValueName: ""; ValueData: "{app}\com.simonrendon.zen_browser_use_secure.json"; Flags: uninsdeletekey

[Code]
function JsonEscapePath(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
end;

procedure WriteNativeHostManifest;
var
  Manifest: String;
begin
  Manifest :=
    '{' + #13#10 +
    '  "name": "com.simonrendon.zen_browser_use_secure",' + #13#10 +
    '  "description": "Secure Browser Use native-messaging bridge for Zen",' + #13#10 +
    '  "path": "' + JsonEscapePath(ExpandConstant('{app}\zen-browser-use-secure-bridge.exe')) + '",' + #13#10 +
    '  "type": "stdio",' + #13#10 +
    '  "allowed_extensions": ["{2ed87dbc-332c-4f85-9655-bd6e7b932d43}"]' + #13#10 +
    '}' + #13#10;
  SaveStringToFile(ExpandConstant('{app}\com.simonrendon.zen_browser_use_secure.json'), Manifest, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    WriteNativeHostManifest;
end;
