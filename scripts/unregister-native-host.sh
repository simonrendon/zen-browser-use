#!/bin/sh
set -eu

uname_s="$(uname -s)"

if [ "$uname_s" = "Darwin" ]; then
  install_dir="$HOME/Library/Application Support/Secure Browser Use for Zen"
  rm -f "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts/com.simonrendon.zen_browser_use_secure.json"
elif [ "$uname_s" = "Linux" ]; then
  install_dir="${XDG_DATA_HOME:-$HOME/.local/share}/Secure Browser Use for Zen"
  rm -f "$HOME/.mozilla/native-messaging-hosts/com.simonrendon.zen_browser_use_secure.json"
  rm -f "$HOME/.zen/native-messaging-hosts/com.simonrendon.zen_browser_use_secure.json"
else
  printf 'Unsupported OS: %s\n' "$uname_s" >&2
  exit 1
fi

rm -f "$install_dir/zen-browser-use-secure-bridge" "$install_dir/com.simonrendon.zen_browser_use_secure.json"
rmdir "$install_dir" 2>/dev/null || true
printf 'Removed the per-user Secure Browser Use for Zen installation.\n'
