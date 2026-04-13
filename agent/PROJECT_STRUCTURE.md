# Project Structure Guidelines

## General Principles

- This project is currently frontend-only and static-hosted
- Group related files together
- Avoid dumping everything into one folder
- Prefer canonical folder-based page routes over standalone top-level HTML files for feature pages

---

## Recommended Structure
```text
/index.html
/lifecycle/index.html
/ordering-guides/index.html
/asset-reports/index.html
/lab-portal/index.html

/src
  /features
  /shared

/vendor
```

---

## Rules

- No deeply nested folders unless necessary
- File names should be descriptive
- Avoid duplicate logic across files
- New feature pages should live in their own folder with `index.html` when that route is intended to be user-facing
- Top-level legacy HTML files should only exist as redirects when backward compatibility is needed

---

## Agent Expectations

When creating new files:
- Place them in the correct feature or shared area
- Do not invent random folders
- Reuse existing structure when possible

---

## If Unsure

Ask:
"Should this live in a feature folder, shared module, or a compatibility redirect?"
