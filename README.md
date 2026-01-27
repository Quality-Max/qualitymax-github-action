# QualityMax Test Runner

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-QualityMax-blue?logo=github)](https://github.com/marketplace/actions/qualitymax-test-runner)

**Add AI-powered E2E testing to your CI/CD in 2 minutes.**

Run your QualityMax tests automatically on every push, PR, or schedule. Get instant feedback with test results posted directly to your pull requests.

## Quick Start

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Run QualityMax Tests
        uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-id: 'your-project-id'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Features

- 🚀 **Zero Configuration** - Just add your API key and project ID
- 🤖 **AI-Powered** - Tests are generated and maintained by AI
- 📊 **PR Comments** - Automatic test result summaries on pull requests
- ⚡ **Fast Feedback** - Results in minutes, not hours
- 🔄 **Auto-Retry** - Flaky test detection and automatic retries
- 📹 **Artifacts** - Screenshots and videos for failed tests

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | QualityMax API key | ✅ | - |
| `project-id` | QualityMax project ID | ✅ | - |
| `test-suite` | Suite to run: `all`, `smoke`, `regression` | ❌ | `all` |
| `test-ids` | Comma-separated test IDs for custom runs | ❌ | - |
| `base-url` | Base URL to test (overrides project default) | ❌ | - |
| `browser` | Browser: `chromium`, `firefox`, `webkit` | ❌ | `chromium` |
| `headless` | Run in headless mode | ❌ | `true` |
| `timeout-minutes` | Maximum execution time | ❌ | `30` |
| `fail-on-test-failure` | Fail workflow if tests fail | ❌ | `true` |
| `post-pr-comment` | Post results as PR comment | ❌ | `true` |

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

## Examples

### Run Smoke Tests on Every PR

```yaml
name: Smoke Tests
on: pull_request

jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: Quality-Max/qualitymax-github-action@v1
        with:
          api-key: ${{ secrets.QUALITYMAX_API_KEY }}
          project-id: 'proj_abc123'
          test-suite: 'smoke'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Run Full Regression on Main Branch

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
          project-id: 'proj_abc123'
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
          project-id: 'proj_abc123'
          base-url: ${{ github.event.deployment_status.target_url }}
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

### Continue on Test Failure

```yaml
- uses: Quality-Max/qualitymax-github-action@v1
  with:
    api-key: ${{ secrets.QUALITYMAX_API_KEY }}
    project-id: 'proj_abc123'
    fail-on-test-failure: 'false'
```

## Getting Your API Key

1. Go to [app.qamax.co](https://app.qamax.co)
2. Navigate to **Settings** → **API Keys**
3. Click **Generate API Key**
4. Copy the key (starts with `qm_`)
5. Add it as a secret in your repository: **Settings** → **Secrets** → **QUALITYMAX_API_KEY**

## Getting Your Project ID

1. Go to [app.qamax.co](https://app.qamax.co)
2. Open your project
3. Copy the project ID from the URL or project settings

## PR Comment Example

When tests complete, a comment is automatically posted to your PR:

---

## 🧪 QualityMax Test Results

| Status | Tests | Duration |
|--------|-------|----------|
| ✅ Passed | 12/12 | 2m 34s |

### Summary
- **Browser:** Chromium
- **Base URL:** https://staging.example.com
- **Commit:** `abc1234`

[View Full Report](https://app.qamax.co/results/gha_xyz789)

---

## Troubleshooting

### API Key Invalid

Make sure your API key:
- Starts with `qm_`
- Is stored as a repository secret (not hardcoded)
- Has not expired

### Tests Not Found

Verify that:
- The project ID is correct
- Your tests are tagged with the correct suite (`smoke`, `regression`)
- You have tests created in QualityMax

### PR Comment Not Posting

Ensure you've added `GITHUB_TOKEN` to your workflow:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Support

- 📚 [Documentation](https://qamax.co)
- 📧 [Email Support](mailto:contact@qamax.co)
- 🐛 [Report Issues](https://github.com/Quality-Max/qualitymax-github-action/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.
