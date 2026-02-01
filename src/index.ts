/**
 * QualityMax GitHub Action
 *
 * Run AI-powered E2E tests in your CI/CD pipeline.
 * Zero configuration, instant results.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { QualityMaxClient } from './api';
import {
  ActionInputs,
  GitHubContext,
  TriggerTestsRequest,
  TestExecutionResults,
} from './types';

/**
 * Parse action inputs from workflow
 */
function getInputs(): ActionInputs {
  const testIdsInput = core.getInput('test-ids');

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
      if (!match) {
        const available = projects.map((p) => p.name).join(', ');
        throw new Error(
          `Project "${inputs.projectName}" not found. Available projects: ${available || 'none'}`
        );
      }
      resolvedProjectId = match.id;
      core.info(`Resolved project "${inputs.projectName}" → ${resolvedProjectId}`);
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

    // Wait for completion
    const timeoutMs = inputs.timeoutMinutes * 60 * 1000;
    const results = await client.waitForCompletion(executionId, timeoutMs);

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

    // Fail if tests failed and failOnTestFailure is enabled
    if (results.result === 'failed' && inputs.failOnTestFailure) {
      core.setFailed(
        `${results.failed_tests} test(s) failed. View report: ${results.report_url}`
      );
    } else if (results.result === 'passed') {
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
