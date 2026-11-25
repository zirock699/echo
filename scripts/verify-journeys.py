"""Run Echo Studio's maintained checks sequentially against local fixtures."""

import argparse
from pathlib import Path
import shlex
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]


def browser_suite(name):
    return (sys.executable, '-u', f'tests/browser_{name}.py')


# Keep the maintained loopback suites explicit. Historical inlined scripts use a different harness.
JOURNEYS = {
    'build': (
        'Unit tests and packaged Worker',
        ('npm', 'test'),
        ('npm', 'run', 'build'),
        ('node', '--check', 'dist/server/index.js'),
    ),
    'start': (
        'Start speaking, resume a lesson and return from a cue',
        browser_suite('first_practice'),
        browser_suite('speaking_prompts'),
    ),
    'prepare': (
        'Import, prepare and validate a reference',
        browser_suite('reference_preparation'),
        browser_suite('provider_activation'),
        browser_suite('media_integrity'),
    ),
    'organise': (
        'Find, organise, edit and review lessons',
        browser_suite('navigation'),
        browser_suite('practice_integrity'),
    ),
    'play': (
        'Play, seek, repeat and operate practice tools',
        browser_suite('original_playback'),
        browser_suite('sync'),
        browser_suite('player_focus'),
        browser_suite('rehearsal_desk'),
        browser_suite('echo_mirror'),
        browser_suite('queue_window'),
    ),
    'recover': (
        'Protect, recover and resume private work',
        browser_suite('private_library'),
        browser_suite('device_recovery'),
        browser_suite('offline'),
    ),
    'scale': (
        'Repeat practice with a large library',
        browser_suite('playback_scale'),
    ),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--journey', action='append', choices=JOURNEYS,
        help='Select one group. Repeat to select more. All groups run by default.',
    )
    parser.add_argument('--list', action='store_true', help='Print the plan without running any checks.')
    options = parser.parse_args()

    selected = set(options.journey or JOURNEYS)
    completed = 0
    for name, (description, *commands) in JOURNEYS.items():
        if name not in selected:
            continue
        print(f'\n[{name}] {description}', flush=True)
        for command in commands:
            label = shlex.join(command)
            print(f'  {label}', flush=True)
            if options.list:
                continue
            try:
                status = subprocess.run(command, cwd=ROOT).returncode
            except OSError as error:
                print(f'FAIL [{name}] Could not start {label} ({error})', file=sys.stderr, flush=True)
                return 127 if isinstance(error, FileNotFoundError) else 1
            if status:
                print(f'FAIL [{name}] {label} (exit {status})', file=sys.stderr, flush=True)
                return status if status > 0 else 128 - status
            completed += 1
    if not options.list:
        print(f'\nPASS {completed} checks across {len(selected)} journey groups', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
