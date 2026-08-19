#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$script_dir/.." && pwd)

usage() {
  echo "Usage:" >&2
  echo "  $0 [path [line [column]]]" >&2
  echo "  $0 --diff left-path right-path" >&2
}

resolve_target() {
  local target_path=$1

  if [[ "$target_path" != /* ]]; then
    target_path="$repo_root/$target_path"
  fi

  if [[ ! -e "$target_path" ]]; then
    echo "VS Code target does not exist: $target_path" >&2
    exit 1
  fi

  wslpath -w "$target_path"
}

if [[ "${1:-}" == "--diff" ]]; then
  if (( $# != 3 )); then
    usage
    exit 2
  fi

  left_target=$(resolve_target "$2")
  right_target=$(resolve_target "$3")
  exec cmd.exe /D /C code --reuse-window --diff "$left_target" "$right_target"
fi

if (( $# > 3 )); then
  usage
  exit 2
fi

target_path=${1:-$repo_root}
line=${2:-}
column=${3:-}

if [[ -n "$line" && ! "$line" =~ ^[1-9][0-9]*$ ]]; then
  echo "Line must be a positive integer." >&2
  usage
  exit 2
fi

if [[ -n "$column" && ! "$column" =~ ^[1-9][0-9]*$ ]]; then
  echo "Column must be a positive integer." >&2
  usage
  exit 2
fi

windows_target=$(resolve_target "$target_path")

if [[ -n "$line" ]]; then
  windows_target="$windows_target:$line"
  if [[ -n "$column" ]]; then
    windows_target="$windows_target:$column"
  fi
  exec cmd.exe /D /C code --reuse-window --goto "$windows_target"
fi

exec cmd.exe /D /C code --reuse-window "$windows_target"
