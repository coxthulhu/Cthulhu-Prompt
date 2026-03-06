import os
import subprocess
import sys
from typing import Sequence


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

    test_exit_code, test_output = run_command(
        ['npx.cmd', 'playwright', 'test', *args],
        test_env,
    )
    all_output.append(test_output)

    if test_exit_code == 0:
        sys.stdout.write('PASS\n')
        return 0

    sys.stdout.write(''.join(all_output))
    return test_exit_code


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
