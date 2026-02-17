/**
 * QualityMax GitHub Action
 *
 * Run AI-powered E2E tests in your CI/CD pipeline.
 * Zero configuration, instant results.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { QualityMaxClient } from './api';
import {
  ActionInputs,
  GitHubContext,
  TriggerTestsRequest,
  TriggerTestsResponse,
  TestExecutionResults,
  EmbeddedScript,
  SeedTestsResponse,
} from './types';

/**
 * Parse action inputs from workflow
 */
function getInputs(): ActionInputs {
  const testIdsInput = core.getInput('test-ids');
  const seedDescInput = core.getInput('seed-descriptions');

  return {
    apiKey: core.getInput('api-key', { required: true }),
    projectId: core.getInput('project-id') || '',
    projectName: core.getInput('project-name') || '',
    testSuite: core.getInput('test-suite') || 'all',
    testIds: testIdsInput
      ? testIdsInput.split(',').map((id) => parseInt(id.trim(), 10))
      : undefined,
    baseUrl: core.getInput('base-url') || undefined,
    browser: core.getInput('browser') || 'chromium',
    headless: core.getInput('headless') !== 'false',
    timeoutMinutes: parseInt(core.getInput('timeout-minutes') || '30', 10),
    failOnTestFailure: core.getInput('fail-on-test-failure') !== 'false',
    postPrComment: core.getInput('post-pr-comment') !== 'false',
    mode: (core.getInput('mode') || 'run') as 'run' | 'seed',
    autoDiscover: core.getInput('auto-discover') !== 'false',
    maxSeedTests: parseInt(core.getInput('max-seed-tests') || '3', 10),
    seedDescriptions: seedDescInput
      ? seedDescInput.split('\n').map((d) => d.trim()).filter((d) => d)
      : undefined,
  };
}

/**
 * Get GitHub context from the workflow
 */
function getGitHubContext(): GitHubContext {
  const context = github.context;

  return {
    repository: `${context.repo.owner}/${context.repo.repo}`,
    sha: context.sha,
    ref: context.ref,
    run_id: context.runId.toString(),
    run_number: context.runNumber,
    pr_number: context.payload.pull_request?.number,
    actor: context.actor,
    event_name: context.eventName,
  };
}

/**
 * Set action outputs
 */
function setOutputs(results: TestExecutionResults): void {
  core.setOutput('execution-id', results.execution_id);
  core.setOutput('status', results.result);
  core.setOutput('total-tests', results.total_tests.toString());
  core.setOutput('passed-tests', results.passed_tests.toString());
  core.setOutput('failed-tests', results.failed_tests.toString());
  core.setOutput('duration-seconds', results.duration_seconds.toString());
  core.setOutput('report-url', results.report_url);
  core.setOutput('summary-markdown', results.summary_markdown || '');
}

/**
 * Post a comment on the PR with test results
 */
async function postPrComment(
  results: TestExecutionResults,
  _inputs: ActionInputs
): Promise<void> {
  const context = github.context;

  // Only post comment on PRs
  if (!context.payload.pull_request) {
    core.debug('Not a PR, skipping comment');
    return;
  }

  const prNumber = context.payload.pull_request.number;
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    core.warning(
      'GITHUB_TOKEN not available, cannot post PR comment. ' +
        'Add `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to your workflow.'
    );
    return;
  }

  try {
    const octokit = github.getOctokit(token);

    // Use the pre-formatted markdown from the API
    const body =
      results.summary_markdown ||
      generateFallbackMarkdown(results);

    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body,
    });

    core.info(`Posted test results to PR #${prNumber}`);
  } catch (error) {
    core.warning(`Failed to post PR comment: ${error}`);
  }
}

/**
 * Generate fallback markdown if API doesn't provide it
 */
function generateFallbackMarkdown(results: TestExecutionResults): string {
  const statusEmoji = results.result === 'passed' ? '✅' : '❌';
  const statusText = results.result === 'passed' ? 'Passed' : 'Failed';

  const minutes = Math.floor(results.duration_seconds / 60);
  const seconds = Math.floor(results.duration_seconds % 60);
  const durationStr = `${minutes}m ${seconds}s`;

  let md = `## 🧪 QualityMax Test Results

| Status | Tests | Duration |
|--------|-------|----------|
| ${statusEmoji} ${statusText} | ${results.passed_tests}/${results.total_tests} | ${durationStr} |

### Summary
- **Browser:** ${results.browser}
- **Base URL:** ${results.base_url || 'Default'}
`;

  if (results.failed_tests > 0) {
    md += '\n### ❌ Failed Tests\n\n';
    md += '| Test | Error |\n|------|-------|\n';
    for (const test of results.tests) {
      if (test.status === 'failed') {
        const error = (test.error_message || 'Unknown error').slice(0, 100);
        md += `| ${test.test_name} | ${error} |\n`;
      }
    }
  }

  md += `\n[View Full Report](${results.report_url})`;

  return md;
}

/**
 * Run tests locally in the GitHub Action runner
 */
async function runTestsLocally(
  triggerResponse: TriggerTestsResponse,
  client: QualityMaxClient,
  inputs: ActionInputs,
): Promise<TestExecutionResults> {
  const scripts = triggerResponse.scripts || [];
  const executionId = triggerResponse.execution_id;

  core.info(`Running ${scripts.length} test(s) locally in GitHub Action runner...`);

  // Create temp directory for test files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qamax-'));
  const testDir = path.join(tmpDir, 'tests');
  fs.mkdirSync(testDir, { recursive: true });

  // Write playwright config
  const configContent = `
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  retries: 0,
  reporter: [['json', { outputFile: 'results.json' }], ['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
  projects: [{ name: '${inputs.browser}', use: { browserName: '${inputs.browser === 'chromium' ? 'chromium' : inputs.browser === 'firefox' ? 'firefox' : 'webkit'}' } }],
});
`;
  fs.writeFileSync(path.join(tmpDir, 'playwright.config.js'), configContent);

  // Write each test script to a file
  const scriptMap = new Map<string, EmbeddedScript>();
  for (const script of scripts) {
    const safeFileName = `test-${script.id}.spec.js`;
    const filePath = path.join(testDir, safeFileName);

    // Strip TypeScript type annotations for .js execution
    let code = script.code;
    // Remove import type statements
    code = code.replace(/import\s+type\s+\{[^}]*\}\s+from\s+['"][^'"]*['"];?\s*/g, '');
    // Remove type annotations from parameters: (page: Page) -> (page)
    code = code.replace(/(\w+)\s*:\s*(?:Page|BrowserContext|Browser|Locator|FrameLocator|APIRequestContext)\b/g, '$1');

    fs.writeFileSync(filePath, code);
    scriptMap.set(safeFileName, script);
    core.info(`  Wrote ${safeFileName}: ${script.name}`);
  }

  // Install Playwright
  core.info('Installing Playwright...');
  const packageJson = JSON.stringify({
    dependencies: {
      '@playwright/test': 'latest',
    },
  });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), packageJson);

  await exec('npm', ['install', '--no-audit', '--no-fund'], { cwd: tmpDir, silent: true });
  await exec('npx', ['playwright', 'install', '--with-deps', inputs.browser], { cwd: tmpDir, silent: true });

  // Run tests
  core.info('Running Playwright tests...');
  const startTime = Date.now();
  let exitCode = 0;
  try {
    exitCode = await exec('npx', ['playwright', 'test', '--config=playwright.config.js'], {
      cwd: tmpDir,
      ignoreReturnCode: true,
    });
  } catch (error) {
    core.warning(`Playwright execution error: ${error}`);
    exitCode = 1;
  }

  const durationSeconds = (Date.now() - startTime) / 1000;

  // Parse results from JSON reporter
  let passedTests = 0;
  let failedTests = 0;
  let totalTests = scripts.length;
  let skippedTests = 0;
  const testResults: TestExecutionResults['tests'] = [];

  const resultsFile = path.join(tmpDir, 'results.json');
  if (fs.existsSync(resultsFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
      const suites = raw.suites || [];

      for (const suite of suites) {
        for (const spec of suite.specs || []) {
          const fileName = path.basename(suite.file || '');
          const script = scriptMap.get(fileName);
          const testStatus = spec.ok ? 'passed' : 'failed';
          const testDuration = (spec.tests?.[0]?.results?.[0]?.duration || 0) / 1000;
          const errorMsg = spec.tests?.[0]?.results?.[0]?.error?.message;

          if (testStatus === 'passed') passedTests++;
          else failedTests++;

          testResults.push({
            test_id: script?.id || 0,
            test_name: script?.name || spec.title || fileName,
            status: testStatus as 'passed' | 'failed',
            duration_seconds: testDuration,
            error_message: errorMsg,
          });
        }
      }
    } catch (error) {
      core.warning(`Failed to parse Playwright results: ${error}`);
    }
  }

  // If no results parsed, infer from exit code
  if (testResults.length === 0) {
    if (exitCode === 0) {
      passedTests = totalTests;
    } else {
      failedTests = totalTests;
    }
    for (const script of scripts) {
      testResults.push({
        test_id: script.id,
        test_name: script.name,
        status: exitCode === 0 ? 'passed' : 'failed',
        duration_seconds: durationSeconds / scripts.length,
        error_message: exitCode !== 0 ? 'Test execution failed' : undefined,
      });
    }
  }

  skippedTests = totalTests - passedTests - failedTests;
  if (skippedTests < 0) skippedTests = 0;

  const overallResult = passedTests > 0 && failedTests === 0 ? 'passed' : 'failed';
  const overallStatus = overallResult === 'passed' ? 'completed' : 'failed';

  // Clean up temp directory
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }

  // Report results back to API
  await client.reportResults(executionId, overallResult as 'passed' | 'failed', passedTests, failedTests, totalTests);

  const results: TestExecutionResults = {
    execution_id: executionId,
    status: overallStatus as TestExecutionResults['status'],
    result: overallResult as TestExecutionResults['result'],
    total_tests: totalTests,
    passed_tests: passedTests,
    failed_tests: failedTests,
    skipped_tests: skippedTests,
    duration_seconds: durationSeconds,
    started_at: new Date(startTime).toISOString(),
    completed_at: new Date().toISOString(),
    browser: inputs.browser,
    report_url: `https://app.qamax.co/results/${executionId}`,
    tests: testResults,
  };

  return results;
}

/**
 * Write job summary
 */
async function writeJobSummary(results: TestExecutionResults): Promise<void> {
  const statusEmoji = results.result === 'passed' ? '✅' : '❌';

  await core.summary
    .addHeading(`${statusEmoji} QualityMax Test Results`)
    .addTable([
      [
        { data: 'Metric', header: true },
        { data: 'Value', header: true },
      ],
      ['Status', results.result.toUpperCase()],
      ['Total Tests', results.total_tests.toString()],
      ['Passed', `✅ ${results.passed_tests}`],
      ['Failed', `❌ ${results.failed_tests}`],
      ['Skipped', `⏭️ ${results.skipped_tests}`],
      ['Duration', `${Math.round(results.duration_seconds)}s`],
      ['Browser', results.browser],
    ])
    .addLink('View Full Report', results.report_url)
    .write();
}

/**
 * Main action logic
 */
async function run(): Promise<void> {
  let executionId: string | undefined;
  let client: QualityMaxClient | undefined;

  try {
    // Get inputs
    const inputs = getInputs();

    core.info('🚀 QualityMax Test Runner');
    core.info(`Project: ${inputs.projectId || inputs.projectName || '(auto-detect)'}`);
    core.info(`Test Suite: ${inputs.testSuite}`);
    core.info(`Browser: ${inputs.browser}`);

    // Initialize client
    client = new QualityMaxClient(inputs.apiKey);

    // Validate API key
    core.info('Validating API key...');
    const isValid = await client.validateApiKey();
    if (!isValid) {
      throw new Error(
        'Invalid API key. Get your API key from app.qamax.co/settings/api'
      );
    }
    core.info('API key validated ✓');

    // Resolve project ID
    const ghContext = getGitHubContext();
    let resolvedProjectId = inputs.projectId;

    if (resolvedProjectId) {
      core.info(`Using provided project ID: ${resolvedProjectId}`);
    } else if (inputs.projectName) {
      core.info(`Resolving project by name: "${inputs.projectName}"...`);
      const projects = await client.getProjects();
      const match = projects.find(
        (p) => p.name.toLowerCase() === inputs.projectName.toLowerCase()
      );
      if (match) {
        resolvedProjectId = String(match.id);
        core.info(`Resolved project "${inputs.projectName}" → ${resolvedProjectId}`);
      } else {
        // Fallback: try resolving by linked repository URL
        core.info(
          `No exact name match for "${inputs.projectName}". ` +
            `Trying to resolve by repository: ${ghContext.repository}...`
        );
        const fallback = await client.resolveProject(ghContext.repository);
        if (fallback) {
          resolvedProjectId = fallback;
          core.info(
            `Resolved project via linked repository → ${resolvedProjectId}`
          );
        } else {
          const available = projects.map((p) => p.name).join(', ');
          throw new Error(
            `Project "${inputs.projectName}" not found. Available projects: ${available || 'none'}. ` +
              'Tip: use the exact project name from QualityMax, or link the repository to your project.'
          );
        }
      }
    } else {
      core.info(`Auto-detecting project from repository: ${ghContext.repository}...`);
      const detected = await client.resolveProject(ghContext.repository);
      if (!detected) {
        throw new Error(
          'Could not auto-detect project. Provide project-id or project-name input, ' +
            'or link your repository in QualityMax project settings.'
        );
      }
      resolvedProjectId = detected;
      core.info(`Auto-detected project: ${resolvedProjectId}`);
    }

    // Handle seed mode
    if (inputs.mode === 'seed') {
      core.info('Running in seed mode — generating test cases...');
      const seedResponse = await client.seedTests({
        project_id: resolvedProjectId,
        base_url: inputs.baseUrl,
        descriptions: inputs.seedDescriptions,
        auto_discover: inputs.autoDiscover,
        max_tests: inputs.maxSeedTests,
      });

      core.setOutput('tests-created', seedResponse.tests_created.toString());
      core.setOutput('tests-skipped', seedResponse.skipped.toString());
      core.setOutput('seed-message', seedResponse.message);

      core.info('');
      core.info('═══════════════════════════════════════');
      core.info(`  Seeded: ${seedResponse.tests_created} test(s)`);
      core.info(`  Skipped: ${seedResponse.skipped} existing`);
      core.info(`  Message: ${seedResponse.message}`);
      core.info('═══════════════════════════════════════');
      core.info('');

      if (seedResponse.tests_created === 0 && seedResponse.skipped === 0) {
        core.setFailed(seedResponse.message);
      } else {
        core.info('Seed complete. Tests are ready for execution.');
      }
      return;
    }

    // Build request
    const request: TriggerTestsRequest = {
      project_id: resolvedProjectId,
      test_suite: inputs.testSuite,
      test_ids: inputs.testIds,
      base_url: inputs.baseUrl,
      browser: inputs.browser,
      headless: inputs.headless,
      timeout_minutes: inputs.timeoutMinutes,
      github_context: ghContext,
    };

    // Trigger tests
    const triggerResponse = await client.triggerTests(request);
    executionId = triggerResponse.execution_id;

    core.info(`Execution started: ${executionId}`);
    if (triggerResponse.estimated_duration_seconds) {
      core.info(
        `Estimated duration: ${Math.round(
          triggerResponse.estimated_duration_seconds / 60
        )} minutes`
      );
    }

    let results: TestExecutionResults;

    // Check if we should run tests locally
    if (triggerResponse.run_locally && triggerResponse.scripts && triggerResponse.scripts.length > 0) {
      core.info(`Running ${triggerResponse.scripts.length} test(s) locally in GitHub Action runner`);
      results = await runTestsLocally(triggerResponse, client, inputs);
    } else if (triggerResponse.run_locally && triggerResponse.test_files) {
      // Repository-based tests — run via npx playwright test
      core.info(`Running repository tests locally: ${triggerResponse.test_command}`);
      const startTime = Date.now();
      let exitCode = 0;
      try {
        exitCode = await exec('npx', ['playwright', 'test', ...triggerResponse.test_files], {
          ignoreReturnCode: true,
        });
      } catch {
        exitCode = 1;
      }
      const duration = (Date.now() - startTime) / 1000;

      results = {
        execution_id: executionId,
        status: exitCode === 0 ? 'completed' : 'failed',
        result: exitCode === 0 ? 'passed' : 'failed',
        total_tests: triggerResponse.test_files.length,
        passed_tests: exitCode === 0 ? triggerResponse.test_files.length : 0,
        failed_tests: exitCode !== 0 ? triggerResponse.test_files.length : 0,
        skipped_tests: 0,
        duration_seconds: duration,
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        browser: inputs.browser,
        report_url: `https://app.qamax.co/results/${executionId}`,
        tests: [],
      };
    } else {
      // Remote execution — poll for completion
      const timeoutMs = inputs.timeoutMinutes * 60 * 1000;
      results = await client.waitForCompletion(executionId, timeoutMs);
    }

    // Set outputs
    setOutputs(results);

    // Write job summary
    await writeJobSummary(results);

    // Post PR comment if enabled
    if (inputs.postPrComment) {
      await postPrComment(results, inputs);
    }

    // Log results
    core.info('');
    core.info('═══════════════════════════════════════');
    core.info(`  Tests: ${results.passed_tests}/${results.total_tests} passed`);
    core.info(`  Duration: ${Math.round(results.duration_seconds)}s`);
    core.info(`  Report: ${results.report_url}`);
    core.info('═══════════════════════════════════════');
    core.info('');

    // Determine if tests actually passed
    const executionFailed =
      results.result === 'failed' ||
      results.status === 'failed' ||
      results.status === 'cancelled' ||
      results.status === 'timeout' ||
      (results.passed_tests === 0 && results.total_tests > 0);

    // Fail if tests failed and failOnTestFailure is enabled
    if (executionFailed && inputs.failOnTestFailure) {
      core.setFailed(
        `${results.failed_tests} of ${results.total_tests} test(s) failed. View report: ${results.report_url}`
      );
    } else if (!executionFailed && results.passed_tests > 0) {
      core.info('✅ All tests passed!');
    }
  } catch (error) {
    // Try to cancel execution on error
    if (executionId && client) {
      try {
        await client.cancelExecution(executionId);
      } catch {
        // Ignore cancellation errors
      }
    }

    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

// Run the action
run();
