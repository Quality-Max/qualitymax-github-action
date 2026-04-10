<p align="center">
  <img src="https://app.qualitymax.io/static/img/qualitymax-logo-color.png" alt="QualityMax" width="200" />
</p>

<h1 align="center">QualityMax Test Runner</h1>

<p align="center">
  <strong>AI-powered E2E testing for your CI/CD pipeline</strong>
</p>

<p align="center">
  <a href="https://github.com/marketplace/actions/qualitymax-e2e-tests"><img src="https://img.shields.io/badge/GitHub%20Marketplace-QualityMax-blue?logo=github" alt="GitHub Marketplace" /></a>
  <a href="https://github.com/Quality-Max/qualitymax-github-action/releases"><img src="https://img.shields.io/github/v/release/Quality-Max/qualitymax-github-action?label=version" alt="Version" /></a>
  <a href="https://github.com/Quality-Max/qualitymax-github-action/blob/main/LICENSE"><img src="https://img.shields.io/github/license/Quality-Max/qualitymax-github-action" alt="License" /></a>
</p>

---

Run your QualityMax tests automatically on every push, PR, or schedule. Get instant feedback with test results posted directly to your pull requests.

## Quick Start

The simplest way to get started — just provide your project name:

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - name: Run QualityMax Tests
        uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-name: 'My Web App'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Three Ways to Identify Your Project

### 1. By Project Name (Recommended)

Use the human-readable project name from your QualityMax dashboard:

```yaml
- uses: Quality-Max/qualitymax-github-action@v1
  with:
    api-key: ${{ secrets.QUALITYMAX_API_KEY }}
    project-name: 'My Web App'
```

### 2. By Project ID

Use the project ID directly (useful for automation or when names might change):

```yaml
- uses: Quality-Max/qualitymax-github-action@v1
  with:
    api-key: ${{ secrets.QUALITYMAX_API_KEY }}
    project-id: 'proj_abc123'
```

### 3. Auto-Detect from Repository

If your GitHub repository is linked to a QualityMax project, omit both — the action resolves it automatically:

```yaml
- uses: Quality-Max/qualitymax-github-action@v1
  with:
    api-key: ${{ secrets.QUALITYMAX_API_KEY }}
    # Auto-detected from repository
```

**Resolution order:** `project-id` > `project-name` > auto-detect from repository.

## Features

- **Zero Configuration** — Just add your API key and project reference
- **AI-Powered** — Tests are generated and maintained by AI
- **PR Comments** — Automatic test result summaries on pull requests
- **Fast Feedback** — Results in minutes, not hours
- **Auto-Retry** — Flaky test detection and automatic retries
- **Seed Mode** — Bootstrap tests via AI discovery directly from CI
- **Local Execution** — Run tests in the GitHub runner when configured

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | QualityMax API key | Yes | — |
| `project-id` | QualityMax project ID | No | — |
| `project-name` | QualityMax project name (alternative to project-id) | No | — |
| `test-suite` | Suite to run: `all`, `smoke`, `regression`, `custom` | No | `all` |
| `test-ids` | Comma-separated test IDs for custom runs | No | — |
| `base-url` | Base URL to test (overrides project default) | No | — |
| `browser` | Browser: `chromium`, `firefox`, `webkit` | No | `chromium` |
| `headless` | Run in headless mode | No | `true` |
| `timeout-minutes` | Maximum execution time | No | `30` |
| `fail-on-test-failure` | Fail workflow if tests fail | No | `true` |
| `post-pr-comment` | Post results as PR comment | No | `true` |
| `mode` | Action mode: `run` (execute tests) or `seed` (bootstrap tests via AI) | No | `run` |
| `auto-discover` | Auto-discover test scenarios in seed mode | No | `true` |
| `max-seed-tests` | Maximum tests to generate in seed mode (1-10) | No | `3` |
| `seed-descriptions` | Newline-separated test descriptions for seed mode | No | — |
| `shard` | Matrix shard index (1-based), used with `shards-total` for parallel execution | No | — |
| `shards-total` | Total number of shards. Required when `shard` is set | No | — |

> **Note:** Either `project-id`, `project-name`, or a linked repository is required. If none are provided, the action attempts auto-detection from the repository URL.

## Outputs

| Output | Description |
|--------|-------------|
| `execution-id` | Unique execution ID |
| `status` | Final status: `passed`, `failed`, `cancelled`, `timeout` |
| `total-tests` | Total tests run |
| `passed-tests` | Tests that passed |
| `failed-tests` | Tests that failed |
| `duration-seconds` | Total execution time |
| `report-url` | URL to full test report |
| `summary-markdown` | Pre-formatted markdown summary |
| `tests-created` | Tests created (seed mode only) |
| `tests-skipped` | Tests skipped (seed mode only) |
| `seed-message` | Summary message (seed mode only) |

## Permissions

For PR comments and job summaries, add these permissions to your workflow job:

```yaml
permissions:
  pull-requests: write   # Required for PR comments
  contents: read         # Default, for checkout
```

And provide the `GITHUB_TOKEN`:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Examples

### Smoke Tests on Every PR

```yaml
name: Smoke Tests
on: pull_request

jobs:
  smoke:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-name: 'My Web App'
          test-suite: 'smoke'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Full Regression on Main Branch

```yaml
name: Regression Tests
on:
  push:
    branches: [main]

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-name: 'My Web App'
          test-suite: 'regression'
          timeout-minutes: '60'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Test Against Staging Environment

```yaml
name: Staging Tests
on:
  deployment_status:

jobs:
  test:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-name: 'My Web App'
          base-url: ${{ github.event.deployment_status.target_url }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Bootstrap Tests with Seed Mode

```yaml
name: Seed Tests
on: workflow_dispatch

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-name: 'My Web App'
          mode: 'seed'
          max-seed-tests: '5'
          base-url: 'https://staging.example.com'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Run Specific Tests

```yaml
- uses: Quality-Max/qualitymax-github-action@v1
  with:
    api-key: ${{ secrets.QUALITYMAX_API_KEY }}
    project-id: 'proj_abc123'
    test-suite: 'custom'
    test-ids: '1,2,3,4,5'
```

### Matrix Sharding — Parallel Execution

For large test suites, split the run across multiple parallel GitHub runners using Playwright's native `--shard=N/M` flag. Each shard runs a deterministic slice of the tests, cutting wall-clock time nearly linearly with the shard count.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]   # 4 parallel runners
    steps:
      - uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-name: 'My Web App'
          shard: ${{ matrix.shard }}
          shards-total: 4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Each shard:
- Fetches the full set of scripts from QualityMax
- Runs only its slice via `npx playwright test --shard=N/M`
- Reports its own pass/fail back to QualityMax as a separate execution

**When to use it:** test suites of 20+ scripts that take more than a few minutes sequentially. For small suites (< 20 tests) the shard overhead (npm install + browser install per runner) outweighs the savings.

**Tip:** set `fail-fast: false` so a failure in one shard doesn't cancel the others — you want to see every failure on a given commit, not just the first.

### Continue on Test Failure

```yaml
- uses: Quality-Max/qualitymax-github-action@v1
  with:
    api-key: ${{ secrets.QUALITYMAX_API_KEY }}
    project-name: 'My Web App'
    fail-on-test-failure: 'false'
```

## One-Click Setup

Generate a complete workflow file from the QualityMax UI:

1. Go to your project in QualityMax
2. Click **Setup GitHub Action**
3. Copy the generated `.github/workflows/qualitymax.yml` file
4. Add your API key as a repository secret

## Getting Your API Key

1. Go to [app.qualitymax.io](https://app.qualitymax.io)
2. Navigate to **Settings** > **API Keys**
3. Click **Generate API Key**
4. Copy the key (starts with `qm_`)
5. Add it as a secret in your repository: **Settings** > **Secrets** > **QUALITYMAX_API_KEY**

## PR Comment Example

When tests complete, a comment is automatically posted to your PR:

---

## QualityMax Test Results

| Status | Tests | Duration |
|--------|-------|----------|
| Passed | 12/12 | 2m 34s |

### Summary
- **Browser:** Chromium
- **Base URL:** https://staging.example.com
- **Commit:** `abc1234`

[View Full Report](https://app.qualitymax.io/results/gha_xyz789)

---

## Troubleshooting

### API Key Invalid

Make sure your API key:
- Starts with `qm_`
- Is stored as a repository secret (not hardcoded)
- Has not expired

### Project Not Found

If using `project-name`:
- Verify the exact project name in your QualityMax dashboard (case-insensitive match)
- Ensure the API key has access to the project

If using auto-detection:
- Link your GitHub repository in QualityMax project settings
- The repository must match exactly (e.g., `owner/repo`)

### Tests Not Found

Verify that:
- The project ID or name is correct
- Your tests are tagged with the correct suite (`smoke`, `regression`)
- You have tests created in QualityMax

### PR Comment Not Posting

1. Add `permissions: pull-requests: write` to your job
2. Add `GITHUB_TOKEN` to your workflow env:

```yaml
permissions:
  pull-requests: write
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Support

- [Documentation](https://qualitymax.io)
- [Email Support](mailto:contact@qualitymax.io)
- [Report Issues](https://github.com/Quality-Max/qualitymax-github-action/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.
