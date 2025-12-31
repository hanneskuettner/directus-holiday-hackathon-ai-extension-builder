import type { UIMessage } from 'ai';
import type { ComputedRef, Ref } from 'vue';
import type { ExtensionConfig, RequestPreviewOutput } from './schemas';

/**
 * Question for UI (mapped from AskQuestionInput)
 */
export interface Question {
	question: string;
	inputType: 'text' | 'select' | 'collection' | 'field';
	options?: string[];
	context?: { collection?: string };
}

/**
 * AI-generated extension stored in registry
 */
export interface AiExtension {
	slug: string;
	files: Record<string, string>;
	entry: string;
	config: ExtensionConfig;
	createdAt: number;
	updatedAt: number;
}

/**
 * Return type of useAiGeneration composable
 */
export interface UseAiGenerationReturn {
	messages: ComputedRef<UIMessage[]>;
	send: (text: string) => void;
	status: ComputedRef<'idle' | 'streaming' | 'submitted' | 'error'>;
	error: ComputedRef<Error | null>;
	stop: () => void;
	retry: () => void;
	reset: () => void;
	files: Ref<Record<string, string>>;
	config: Ref<ExtensionConfig | null>;
	pendingQuestion: Ref<Question | null>;
	statusMessage: Ref<{ message: string; type: 'info' | 'success' | 'warning' } | null>;
	answerQuestion: (answer: string) => void;
	skipQuestion: () => void;
}

/**
 * Callbacks passed to useAiGeneration
 */
export interface AiGenerationCallbacks {
	onPreview: () => Promise<RequestPreviewOutput>;
}

/**
 * Tool definition for local tools
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
	name: string;
	description: string;
	inputSchema: import('zod/v4').ZodType<TInput>;
	execute: (input: TInput) => Promise<TOutput>;
}
