#!/bin/sh
# Install the APK, start a device log, run one Maestro flow.
#
# Runs as the `script` of reactivecircus/android-emulator-runner, so an
# emulator is already booted and `adb` already talks to it. Two arguments: the
# flow's name (which is its file's name under `.maestro/`) and the attempt
# number.
#
# Every output is named after the flow AND the attempt, because when a flow is
# run twice the interesting one is the attempt that failed, and a second run
# must not write over the evidence from the first.
#
# ## Why Maestro's output is both shown and kept
#
# The job decides whether a failure is worth retrying by reading what Maestro
# said - an emulator that disappeared is retried, a flow that failed on the app
# is not (see e2e.yml). That needs the text in a file. Piping into `tee` would
# hand the step `tee`'s exit code instead of Maestro's, and `pipefail` is not
# POSIX, so the status is carried out of the pipeline through a file.
set -e

flow="$1"
attempt="$2"

if [ -z "$flow" ] || [ -z "$attempt" ]; then
  echo "usage: e2e-flow.sh <flow> <attempt>" >&2
  exit 2
fi

output="$RUNNER_TEMP/maestro-$flow-$attempt.txt"
status_file="$RUNNER_TEMP/maestro-$flow-$attempt.status"

adb install -r app-release.apk

# Started before the flow and left running. Maestro writes the device log into
# the running flow's own output directory, which it cannot do once the device
# has gone - the run that prompted all this left a log for the first flow and
# nothing for the one that crashed. This file holds everything up to the moment
# the device stopped answering.
adb logcat -c
adb logcat > "$RUNNER_TEMP/logcat-$flow-$attempt.txt" &

# The `if` is what lets a failing Maestro run reach the next line at all: with
# `set -e`, a bare failing command would take this subshell down before the
# status could be written.
{
  if maestro test ".maestro/$flow.yaml" 2>&1; then
    echo 0 > "$status_file"
  else
    echo $? > "$status_file"
  fi
} | tee "$output"

exit "$(cat "$status_file")"
