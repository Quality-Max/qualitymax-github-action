/**
 * Types for QualityMax GitHub Action
 */
export interface GitHubContext {
    repository: string;
    sha: string;
    ref: string;
    run_id: string;
    run_number?: number;
    pr_number?: number;
    actor?: string;
    event_name?: string;
}
export interface TriggerTestsRequest {
    project_id: string;
    test_suite?: string;
    test_ids?: number[];
    base_url?: string;
    browser?: string;
    headless?: boolean;
    timeout_minutes?: number;
    github_context: GitHubContext;
    variables?: Record<string, string>;
}
export interface TriggerTestsResponse {
    success: boolean;
    execution_id: string;
    status: TestRunStatus;
    message: string;
    estimated_duration_seconds?: number;
    status_url: string;
    cancel_url: string;
}
export type TestRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type TestResult = 'passed' | 'failed' | 'skipped' | 'error';
export interface TestExecutionStatus {
    execution_id: string;
    status: TestRunStatus;
    progress?: number;
    total_tests?: number;
    completed_tests?: number;
    passed_tests?: number;
    failed_tests?: number;
    started_at?: string;
    estimated_completion?: string;
    current_test?: string;
}
export interface IndividualTestResult {
    test_id: number;
    test_name: string;
    status: TestResult;
    duration_seconds: number;
    error_message?: string;
    screenshot_url?: string;
    video_url?: string;
    retry_count?: number;
}
export interface TestExecutionResults {
    execution_id: string;
    status: TestRunStatus;
    result: TestResult;
    total_tests: number;
    passed_tests: number;
    failed_tests: number;
    skipped_tests: number;
    duration_seconds: number;
    started_at: string;
    completed_at: string;
    browser: string;
    base_url?: string;
    report_url: string;
    tests: IndividualTestResult[];
    github_context?: GitHubContext;
    summary_markdown?: string;
}
export interface SeedTestsRequest {
    project_id: string;
    base_url?: string;
    descriptions?: string[];
    auto_discover: boolean;
    max_tests: number;
}
export interface SeedTestResult {
    test_case_id: number;
    script_id: number;
    name: string;
    tags: string[];
}
export interface SeedTestsResponse {
    success: boolean;
    tests_created: number;
    tests: SeedTestResult[];
    message: string;
    skipped: number;
}
export interface ActionInputs {
    apiKey: string;
    projectId: string;
    projectName: string;
    testSuite: string;
    testIds?: number[];
    baseUrl?: string;
    browser: string;
    headless: boolean;
    timeoutMinutes: number;
    failOnTestFailure: boolean;
    postPrComment: boolean;
    mode: 'run' | 'seed';
    autoDiscover: boolean;
    maxSeedTests: number;
    seedDescriptions?: string[];
}
export interface ActionOutputs {
    executionId: string;
    status: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    durationSeconds: number;
    reportUrl: string;
    summaryMarkdown: string;
}
