Check for uncommitted changes, commit and push them:

## Steps:

1. Run `git status --porcelain` to check for uncommitted changes
2. Run `git log origin/main..HEAD --oneline` to check for unpushed commits
3. If uncommitted changes exist:
   - **Run quality checks first:** `pnpm run lint`
   - If checks fail, fix issues before committing
   - Run `git diff --stat` to understand what changed
   - **If committing a user-facing feature or fix:** Add an entry to `src/lib/changelog.ts` at the top of the array
   - Stage all changes with `git add -A`
   - Create a simple one-line conventional commit (e.g., `feat: add X`, `fix: resolve Y`)
4. If there are commits to push (from step 2 or step 3):
   - Push with `git push`

## Output:
Provide a summary showing: no changes / committed & pushed / error

## IMPORTANT:
- One-line commit only, no multi-line messages
- NO Claude mentions, NO Co-Authored-By, NO "Generated with Claude Code"
- Do NOT ask for confirmation - just execute directly
- Add to changelog for: new features (feat), user-visible bug fixes (fix), UI changes
- Skip changelog for: internal refactors, CI/build changes, code cleanup
