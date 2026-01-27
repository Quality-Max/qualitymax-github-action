/**
 * QualityMax API Client
 */

import * as core from '@actions/core';
import { HttpClient } from '@actions/http-client';
import {
  TriggerTestsRequest,
  TriggerTestsResponse,
  TestExecutionStatus,
  TestExecutionResults,
} from './types';

const API_BASE_URL = process.env.QUALITYMAX_API_URL || 'https://app.qamax.co/api';
const POLL_INTERVAL_MS = 5000; // 5 seconds

export class QualityMaxClient {
  private client: HttpClient;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = new HttpClient('qualitymax-github-action', [], {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'QualityMax-GitHub-Action/1.0',
      },
    });
  }

  /**
   * Validate the API key
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const response = await this.client.get(`${API_BASE_URL}/github-action/validate`);
      const body = await response.readBody();
      const data = JSON.parse(body);
      return data.valid === true;
    } catch (error) {
      core.debug(`API key validation failed: ${error}`);
      return false;
    }
  }

  /**
   * Trigger test execution
   */
  async triggerTests(request: TriggerTestsRequest): Promise<TriggerTestsResponse> {
    core.info(`Triggering tests for project ${request.project_id}...`);

    const response = await this.client.post(
      `${API_BASE_URL}/github-action/trigger`,
      JSON.stringify(request)
    );

    const body = await response.readBody();
    const statusCode = response.message.statusCode || 0;

    if (statusCode >= 400) {
      throw new Error(`Failed to trigger tests: ${body}`);
    }

    const data: TriggerTestsResponse = JSON.parse(body);

    if (!data.success) {
      throw new Error(`Failed to trigger tests: ${data.message}`);
    }

    core.info(`Tests queued with execution ID: ${data.execution_id}`);
    return data;
  }

  /**
   * Get execution status
   */
  async getStatus(executionId: string): Promise<TestExecutionStatus> {
    const response = await this.client.get(
      `${API_BASE_URL}/github-action/status/${executionId}`
    );

    const body = await response.readBody();
    const statusCode = response.message.statusCode || 0;

    if (statusCode === 404) {
      throw new Error(`Execution ${executionId} not found`);
    }

    if (statusCode >= 400) {
      throw new Error(`Failed to get status: ${body}`);
    }

    return JSON.parse(body);
  }

  /**
   * Get execution results
   */
  async getResults(executionId: string): Promise<TestExecutionResults> {
    const response = await this.client.get(
      `${API_BASE_URL}/github-action/results/${executionId}?include_markdown=true`
    );

    const body = await response.readBody();
    const statusCode = response.message.statusCode || 0;

    if (statusCode === 404) {
      throw new Error(`Execution ${executionId} not found or not completed`);
    }

    if (statusCode >= 400) {
      throw new Error(`Failed to get results: ${body}`);
    }

    return JSON.parse(body);
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<void> {
    core.info(`Cancelling execution ${executionId}...`);

    const response = await this.client.post(
      `${API_BASE_URL}/github-action/cancel/${executionId}`,
      ''
    );

    const body = await response.readBody();
    const statusCode = response.message.statusCode || 0;

    if (statusCode >= 400) {
      core.warning(`Failed to cancel execution: ${body}`);
    } else {
      core.info('Execution cancelled');
    }
  }

  /**
   * Poll for execution completion
   */
  async waitForCompletion(
    executionId: string,
    timeoutMs: number
  ): Promise<TestExecutionResults> {
    const startTime = Date.now();
    let lastProgress = -1;

    core.info('Waiting for test execution to complete...');

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getStatus(executionId);

      // Log progress updates
      if (status.progress !== undefined && status.progress !== lastProgress) {
        lastProgress = status.progress;
        const completed = status.completed_tests || 0;
        const total = status.total_tests || 0;
        const currentTest = status.current_test || '';

        core.info(
          `Progress: ${status.progress}% (${completed}/${total} tests)${
            currentTest ? ` - Running: ${currentTest}` : ''
          }`
        );
      }

      // Check if execution is complete
      if (
        status.status === 'completed' ||
        status.status === 'failed' ||
        status.status === 'cancelled' ||
        status.status === 'timeout'
      ) {
        core.info(`Execution finished with status: ${status.status}`);
        return await this.getResults(executionId);
      }

      // Wait before polling again
      await this.sleep(POLL_INTERVAL_MS);
    }

    // Timeout reached - try to cancel and throw error
    core.warning('Execution timeout reached, attempting to cancel...');
    await this.cancelExecution(executionId);
    throw new Error(`Execution timed out after ${timeoutMs / 1000} seconds`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
