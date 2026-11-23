import argparse
from datetime import datetime
import os
from pathlib import Path
import sys
from typing import Sequence
from uuid import uuid4

from RunPlaywrightCompact import remove_profiles, run_command


def main(args: Sequence[str]) -> int:
    """Build, run the performance scenarios, and report the results folder."""
    # Piped Windows output defaults to the ANSI code page, which cannot encode Playwright's status characters.
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    parser = argparse.ArgumentParser(description='Run the rendering performance scenarios.')
    parser.add_argument('--no-profile', action='store_true', help='Skip the DevTools profiling run.')
    parser.add_argument('--scenario', action='append', default=[], help='Run only this scenario; repeatable.')
    options = parser.parse_args(args)

    env = os.environ.copy()
    env['VITE_LOG_LEVEL'] = 'warn'

    build_exit_code, build_output = run_command(['npm.cmd', 'run', 'build'], env)
    if build_exit_code != 0:
        sys.stdout.write(build_output)
        return build_exit_code

    # Each invocation writes its summary, raw results, and trace to its own timestamped folder.
    output_directory = Path('temp', 'performance', datetime.now().strftime('%Y-%m-%d_%H-%M-%S'))
    output_directory.mkdir(parents=True)
    env['DEV_ENVIRONMENT'] = 'PLAYWRIGHT'
    env['PLAYWRIGHT_RUN_ID'] = uuid4().hex
    env['PERF_OUTPUT_DIR'] = str(output_directory.resolve())
    env['PERF_PROFILE'] = '0' if options.no_profile else '1'
    env['PERF_SCENARIOS'] = ','.join(options.scenario)
    # Windows TEMP also supplies Node's os.tmpdir() in the Electron processes.
    profile_directory = Path(env['TEMP']) / 'CthulhuPromptPlaywright' / env['PLAYWRIGHT_RUN_ID']

    try:
        test_exit_code, test_output = run_command(
            ['npx.cmd', 'playwright', 'test', '--config', 'tests/performance/playwright.performance.config.ts'],
            env,
        )
        (output_directory / 'playwright-output.txt').write_text(test_output, encoding='utf-8')
    finally:
        # A lingering Windows file lock should not discard a completed measurement.
        try:
            remove_profiles(profile_directory)
        except OSError as error:
            sys.stderr.write(f'Failed to remove Playwright profiles at {profile_directory}: {error}\n')

    if test_exit_code != 0:
        sys.stdout.write(test_output)
        sys.stdout.write(f'FAILED {output_directory.as_posix()}\n')
        return test_exit_code

    sys.stdout.write(f'COMPLETE {output_directory.as_posix()}\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
