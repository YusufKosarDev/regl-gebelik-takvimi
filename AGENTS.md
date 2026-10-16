# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# `main` is protected — branch and PR, always

Pushing to `main` is rejected. Every change goes:

```
branch → commit → push → PR → three checks green → branch up to date → merge
```

The branch must be up to date with `main` before it can merge, so the checks
run on the code that will actually land. There is no bypass; the rule applies
to the repository owner too.

## Never rename a CI job on its own

The ruleset requires three checks **by name**, and those names are the job
names in `.github/workflows/ci.yml`:

| Ruleset expects | Produced by |
|---|---|
| `Type check, lint and test` | job `check` |
| `Firestore rules (emulator)` | job `rules` |
| `Android module unit tests` | job `android` |

Rename one and nothing goes red. The rule simply never finds a check by that
name, so it has nothing to wait for and the gate reports itself satisfied —
protection that looks exactly like protection and stops nothing. The same
applies to deleting a job, or to splitting one into two.

So: a job rename is two edits, not one. Change `ci.yml` **and** the three
names under Settings → Rules → Rulesets → `main-protection` in the same
change, and say in the PR body that the ruleset needs updating, because the
panel half cannot be reviewed in the diff.

Full detail, including the release order and the one-off panel setup, is in
`RELEASE.md`.
