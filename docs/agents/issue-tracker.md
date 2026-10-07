# Issue tracker: GitHub

Issues and specs live in james-litch/SecretSanta on GitHub.
Use the gh CLI from this repository.

## Conventions

- Create: gh issue create --title "..." --body-file <file>
- Read: gh issue view <number> --json number,title,body,labels,comments
- List: gh issue list --state open --json number,title,body,labels
- Comment: gh issue comment <number> --body-file <file>
- Label: gh issue edit <number> --add-label "..."
- Remove label: gh issue edit <number> --remove-label "..."
- Close: gh issue close <number>

Write multiline issue bodies and comments to a file and use --body-file.
Outside this clone, specify --repo james-litch/SecretSanta.

“Publish to the issue tracker” means create a GitHub issue.
“Fetch the relevant ticket” means read the GitHub issue.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding operations

- Map: one issue labelled wayfinder:map, with Notes,
  Decisions-so-far, and Fog sections.
- Children: link tickets as GitHub sub-issues. If unavailable, use a
  task list in the map and “Part of #<map>” in each child.
- Ticket types: wayfinder:research, wayfinder:prototype,
  wayfinder:grilling, and wayfinder:task.
- Blocking: use native GitHub issue dependencies. If unavailable,
  record “Blocked by: #<number>” in the child body.
- Frontier: select the first open, unassigned child in map order
  whose blockers are all closed.
- Claim: assign the ticket to the driving developer.
- Resolve: comment with the answer, close the ticket, and append
  a summary plus link to the map’s Decisions-so-far.
