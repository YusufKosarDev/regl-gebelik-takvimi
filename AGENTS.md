# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# `main` is protected — branch and PR, always

Pushing to `main` is rejected. Every change goes:

```
branch → commit → push → PR → three checks green → branch up to date → merge
```

The three required checks are the CI job names: `Type check, lint and test`,
`Firestore rules (emulator)`, `Android module unit tests`. Renaming a job in
`.github/workflows/ci.yml` makes the rule stop seeing it — the protection then
passes silently on nothing — so a rename means updating the ruleset in the
GitHub panel in the same breath.

The branch must be up to date with `main` before it can merge, so the checks
run on the code that will actually land. There is no bypass; the rule applies
to the repository owner too.

Full detail, including the release order and the one-off panel setup, is in
`RELEASE.md`.
