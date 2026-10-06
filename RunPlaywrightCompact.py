import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Sequence
from uuid import uuid4


def remove_profiles(profile_directory: Path) -> None:
    """Remove this run's profiles, allowing Windows a short time to release files."""
    # Retry transient file locks for at most two seconds.
    for attempt in range(5):
        try:
            shutil.rmtree(profile_directory)
            return
        except FileNotFoundError:
            return
        except OSError:
            if attempt == 4:
                raise
            time.sleep(0.5)


def run_command(command: Sequence[str], env: dict[str, str]) -> tuple[int, str]:
    try:
        completed = subprocess.run(
            list(command),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            check=False,
        )
    except FileNotFoundError as error:
        return 1, f'{error}\n'

    return completed.returncode, completed.stdout


def main(args: Sequence[str]) -> int:
    base_env = os.environ.copy()
    base_env['VITE_LOG_LEVEL'] = 'warn'

    all_output: list[str] = []

    build_exit_code, build_output = run_command(['npm.cmd', 'run', 'build'], base_env)
    all_output.append(build_output)

    if build_exit_code != 0:
        sys.stdout.write(''.join(all_output))
        return build_exit_code

    test_env = base_env.copy()
    test_env['DEV_ENVIRONMENT'] = 'PLAYWRIGHT'
    # One runner-generated identifier groups every Electron profile for this invocation.
    test_env['PLAYWRIGHT_RUN_ID'] = uuid4().hex
    # Windows TEMP also supplies Node's os.tmpdir() in the Electron processes.
    profile_directory = Path(test_env['TEMP']) / 'CthulhuPromptPlaywright' / test_env['PLAYWRIGHT_RUN_ID']

    # Preserve the original failure when both Playwright and profile cleanup fail.
    test_exit_code = 1
    try:
        test_exit_code, test_output = run_command(
            ['npx.cmd', 'playwright', 'test', *args],
            test_env,
        )
        all_output.append(test_output)
    finally:
        try:
            remove_profiles(profile_directory)
        except OSError as error:
            sys.stderr.write(f'Failed to remove Playwright profiles at {profile_directory}: {error}\n')
            test_exit_code = test_exit_code or 1

    if test_exit_code == 0:
        sys.stdout.write('PASS\n')
        return 0

    sys.stdout.write(''.join(all_output))
    return test_exit_code


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
