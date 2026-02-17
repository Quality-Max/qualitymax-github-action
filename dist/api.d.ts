/**
 * QualityMax API Client
 */
import { TriggerTestsRequest, TriggerTestsResponse, TestExecutionStatus, TestExecutionResults, SeedTestsRequest, SeedTestsResponse } from './types';
export declare class QualityMaxClient {
    private client;
    private apiKey;
    constructor(apiKey: string);
    /**
     * Validate the API key
     */
    validateApiKey(): Promise<boolean>;
    /**
     * Get all projects accessible with this API key
     */
    getProjects(): Promise<{
        id: string;
        name: string;
    }[]>;
    /**
     * Resolve project ID from GitHub repository name
     */
    resolveProject(repository: string): Promise<string | null>;
    /**
     * Trigger test execution
     */
    triggerTests(request: TriggerTestsRequest): Promise<TriggerTestsResponse>;
    /**
     * Get execution status
     */
    getStatus(executionId: string): Promise<TestExecutionStatus>;
    /**
     * Get execution results
     */
    getResults(executionId: string): Promise<TestExecutionResults>;
    /**
     * Cancel execution
     */
    cancelExecution(executionId: string): Promise<void>;
    /**
     * Poll for execution completion
     */
    waitForCompletion(executionId: string, timeoutMs: number): Promise<TestExecutionResults>;
    /**
     * Seed tests for a project using AI discovery + generation
     */
    seedTests(request: SeedTestsRequest): Promise<SeedTestsResponse>;
    private sleep;
}
