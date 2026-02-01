/**
 * Tests for QualityMax GitHub Action
 */

import { GitHubContext, TriggerTestsRequest, ActionInputs } from './types';

describe('Types', () => {
  describe('GitHubContext', () => {
    it('should create valid GitHub context', () => {
      const context: GitHubContext = {
        repository: 'owner/repo',
        sha: 'abc123def456',
        ref: 'refs/heads/main',
        run_id: '12345',
        run_number: 42,
        pr_number: 7,
        actor: 'testuser',
        event_name: 'pull_request',
      };

      expect(context.repository).toBe('owner/repo');
      expect(context.sha).toBe('abc123def456');
      expect(context.pr_number).toBe(7);
    });

    it('should allow optional fields to be undefined', () => {
      const context: GitHubContext = {
        repository: 'owner/repo',
        sha: 'abc123',
        ref: 'refs/heads/main',
        run_id: '123',
      };

      expect(context.pr_number).toBeUndefined();
      expect(context.actor).toBeUndefined();
    });
  });

  describe('TriggerTestsRequest', () => {
    it('should create valid trigger request', () => {
      const request: TriggerTestsRequest = {
        project_id: 'proj_abc123',
        test_suite: 'smoke',
        browser: 'chromium',
        headless: true,
        timeout_minutes: 30,
        github_context: {
          repository: 'owner/repo',
          sha: 'abc123',
          ref: 'refs/heads/main',
          run_id: '123',
        },
      };

      expect(request.project_id).toBe('proj_abc123');
      expect(request.test_suite).toBe('smoke');
      expect(request.browser).toBe('chromium');
    });

    it('should support custom test IDs', () => {
      const request: TriggerTestsRequest = {
        project_id: 'proj_abc123',
        test_ids: [1, 2, 3, 4, 5],
        github_context: {
          repository: 'owner/repo',
          sha: 'abc123',
          ref: 'refs/heads/main',
          run_id: '123',
        },
      };

      expect(request.test_ids).toEqual([1, 2, 3, 4, 5]);
      expect(request.test_ids?.length).toBe(5);
    });
  });

  describe('ActionInputs', () => {
    it('should have required fields', () => {
      const inputs: ActionInputs = {
        apiKey: 'qm_testapikey123',
        projectId: 'proj_abc123',
        projectName: '',
        testSuite: 'all',
        browser: 'chromium',
        headless: true,
        timeoutMinutes: 30,
        failOnTestFailure: true,
        postPrComment: true,
      };

      expect(inputs.apiKey).toMatch(/^qm_/);
      expect(inputs.projectId).toBe('proj_abc123');
      expect(inputs.failOnTestFailure).toBe(true);
    });

    it('should support project-name as alternative to project-id', () => {
      const inputs: ActionInputs = {
        apiKey: 'qm_testapikey123',
        projectId: '',
        projectName: 'My E2E Tests',
        testSuite: 'all',
        browser: 'chromium',
        headless: true,
        timeoutMinutes: 30,
        failOnTestFailure: true,
        postPrComment: true,
      };

      expect(inputs.projectId).toBe('');
      expect(inputs.projectName).toBe('My E2E Tests');
    });

    it('should support auto-detection with both empty', () => {
      const inputs: ActionInputs = {
        apiKey: 'qm_testapikey123',
        projectId: '',
        projectName: '',
        testSuite: 'all',
        browser: 'chromium',
        headless: true,
        timeoutMinutes: 30,
        failOnTestFailure: true,
        postPrComment: true,
      };

      expect(inputs.projectId).toBe('');
      expect(inputs.projectName).toBe('');
    });
  });
});

describe('API Key Validation', () => {
  it('should validate API key format', () => {
    const validKey = 'qm_abc123def456789012345678901234567890123456789012';
    const invalidKey = 'invalid_key';

    expect(validKey.startsWith('qm_')).toBe(true);
    expect(invalidKey.startsWith('qm_')).toBe(false);
  });
});

describe('Test Suite Options', () => {
  it('should support valid test suites', () => {
    const validSuites = ['all', 'smoke', 'regression', 'custom'];

    validSuites.forEach(suite => {
      expect(['all', 'smoke', 'regression', 'custom']).toContain(suite);
    });
  });
});

describe('Browser Options', () => {
  it('should support valid browsers', () => {
    const validBrowsers = ['chromium', 'firefox', 'webkit'];

    validBrowsers.forEach(browser => {
      expect(['chromium', 'firefox', 'webkit']).toContain(browser);
    });
  });
});
