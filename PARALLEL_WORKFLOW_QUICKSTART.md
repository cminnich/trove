# Parallel Workflow Quick Start

TL;DR for running multiple Claude Code sessions on Trove.

## Commands

```bash
# Start new parallel session
./scripts/cc-start extraction-pipeline "Build Jina + Claude extraction"

# Go to worktree and open Claude Code
cd ~/Development/personal/trove-work/extraction-pipeline

# When done, go back to main repo
cd ~/Development/personal/trove

# Finish and merge
./scripts/cc-finish extraction-pipeline

# List active sessions
./scripts/cc-list
```

## Directory Structure

```
~/Development/personal/
  trove/                    # Main repo (main branch)
    ├── scripts/
    │   ├── cc-start
    │   ├── cc-finish
    │   ├── cc-sync
    │   ├── cc-list
    │   └── cc-cleanup
    ├── .clinerules
    ├── PROJECT.md
    └── STACK.md

  trove-work/               # Parallel work area
    ├── extraction-pipeline/  # CC session 1
    ├── collections-ui/       # CC session 2
    └── ai-export/            # CC session 3
```

## Full Documentation

See `~/Development/claude-code-system/PARALLEL_WORKFLOW.md` for:
- Detailed command reference
- Handling conflicts
- Best practices
- Troubleshooting
- Advanced usage

## Branch Naming

All feature branches: `cc/<feature-name>`

Examples:
- `cc/extraction-pipeline`
- `cc/collections-ui`
- `cc/fix-mobile-layout`

## Merge Strategy

**Squash merge** - All feature branch commits squashed into ONE commit on main.

Benefits:
- Clean main history
- Easy to revert features
- CC can commit frequently without polluting history
