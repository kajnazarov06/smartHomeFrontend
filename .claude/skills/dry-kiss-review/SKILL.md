---
name: dry-kiss-review
description: Review a codebase or set of files for DRY (duplicated knowledge) and KISS (unnecessary complexity) issues and report prioritized, concrete fixes. Use when the user asks to check a project, folder, PR or files against DRY / KISS, duplication, or over-engineering.
---

# DRY & KISS Project Review

## 1. Scope the review
- Identify what to review: whole repo, a folder, changed files in a branch/PR, or specific files.
- Detect languages and frameworks (package.json, composer.json, pyproject.toml, go.mod, etc.).
- Skip generated/vendor code: node_modules, vendor, dist, build, .next, lockfiles, minified files, generated API clients.
- For large repos, start with the largest or most-changed source directories and say what was covered.

## 2. Find DRY violations (duplicated knowledge)
- **Copy-pasted logic**: near-identical functions/blocks. Use a tool if available (e.g. `npx jscpd --min-lines 6 <path>`, `pylint --disable=all --enable=duplicate-code`, `phpcpd`), otherwise grep for repeated distinctive lines.
- **Repeated business rules**: same thresholds, rates, status strings, regexes, validation rules in several places.
- **Magic values**: the same literal number/string/URL appearing 3+ times.
- **Duplicated schemas/types**: the same shape defined separately on frontend and backend, or in multiple models/DTOs.
- **Repeated config**: env values, endpoints, timeouts hardcoded in several files.

Before flagging, ask: *does this represent the same knowledge that must change together?* If two blocks only look alike but model different concepts, do NOT recommend merging. Apply the Rule of Three: 2 copies = low priority; 3+ = recommend extraction.

## 3. Find KISS violations (unnecessary complexity)
- **Over-abstraction**: interfaces/factories/strategies/base classes with only one implementation or one caller.
- **Flag-heavy functions**: many boolean/mode parameters (often a symptom of over-DRY).
- **Deep nesting**: more than 3 levels; suggest guard clauses / early returns.
- **Long functions/classes**: functions over ~50 lines or doing several jobs.
- **High cyclomatic complexity**: use tools if available (ESLint `complexity` rule, `radon cc -s`, `phpmd`, `gocyclo`).
- **Reinvented wheels**: custom code that the standard library or an existing dependency already provides.
- **Speculative generality (YAGNI)**: unused params, options, hooks or extension points.
- **Clever code**: dense one-liners, nested ternaries, obscure tricks.
- **Dead code**: unused functions, exports, commented-out blocks.

Do not flag complexity a real requirement needs (security, error handling, concurrency, performance-critical paths); say why it is justified.

## 4. DRY vs KISS tension
If an abstraction removes duplication but is harder to understand than the duplication it replaced (many flags, special cases), recommend splitting it into simpler pieces. Duplication is cheaper than the wrong abstraction.

## 5. Report
1. **Summary**: scope covered, overall health, top 3 fixes.
2. **Findings table**, ordered by impact:
   | # | Principle | Severity | Location (file:line) | Problem | Suggested fix |
3. **Details** for High findings with short before/after sketches.
4. **Acceptable duplication / justified complexity** and why.
5. **Next steps**: offer to apply fixes, safest high-impact first.

Severity: High = business rule duplicated 3+ times or complexity causing bugs; Medium = duplicated helpers, single-use abstractions, deep nesting; Low = minor magic values, style simplifications.

## 6. Applying fixes (only if the user asks)
- One refactor at a time; keep behavior identical.
- Run existing tests/linters after each change; if no tests exist, say so and keep changes small.
- Never delete code without approval; summarize every changed file.
