# Commit policy

- Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). Scopes are optional.
- Include a `Refs: #<issue-number>` footer in commits that work on an issue.
- Apply the commit format and approval policy to every commit, including merge commits; this policy overrides skill defaults.
- After approval, use the reviewed message without rewriting it.
- Present verified changes and the proposed message for human review. Ask one question with `Commit`, `Request changes`, and `Reject` options when no decision is pending.
- A `Commit` decision authorizes only the reviewed diff and message for one commit. Apply requested changes, verify them, and present them again. Leave rejected work uncommitted.
- The merge commit of a pull request into `develop` that auto-merges is pre-approved. Its message is `<type>: merge <branch> into develop (#<number>)`, where `<type>` comes from the pull request title. The human approved this on 2026-10-03. The merge commit of a pull request into `release/0.3.0` that you merge is pre-approved too, as `<type>: merge <branch> into release/0.3.0 (#<number>)`, approved on 2026-10-08. Review still applies to the pull request's own commits.
