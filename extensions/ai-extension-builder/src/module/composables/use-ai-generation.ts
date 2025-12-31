import type { UIMessage } from 'ai';
import type { ExtensionConfig, RequestPreviewOutput } from '../schemas';
import type { Question, ToolDefinition, UseAiGenerationReturn } from '../types';
import { Chat } from '@ai-sdk/vue';
import { useStores } from '@directus/extensions-sdk';
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,

} from 'ai';
import { computed, ref } from 'vue';
import { z } from 'zod/v4';
import { SYSTEM_PROMPT } from '../constants/system-prompt';
import {
	AskQuestionInputSchema,
	DeleteFileInputSchema,
	ExtensionConfigSchema,
	GetCollectionFieldsInputSchema,
	GetFieldSchemaInputSchema,
	ListFilesInputSchema,
	ReadFileInputSchema,
	RenameFileInputSchema,
	RequestPreviewInputSchema,
	SetConfigInputSchema,
	ShowStatusInputSchema,
	WriteFileInputSchema,

} from '../schemas';

// Convert Zod schema to JSON Schema for API
function toApiTool(tool: ToolDefinition) {
	return {
		name: tool.name,
		description: tool.description,
		inputSchema: z.toJSONSchema(tool.inputSchema, { target: 'draft-7' }),
	};
}

interface UseAiGenerationOptions {
	onPreview: () => Promise<RequestPreviewOutput>;
}

export function useAiGeneration(options: UseAiGenerationOptions): UseAiGenerationReturn {
	const { useFieldsStore, useRelationsStore } = useStores();
	const fieldsStore = useFieldsStore();
	const relationsStore = useRelationsStore();

	// State
	const files = ref<Record<string, string>>({});
	const config = ref<ExtensionConfig | null>(null);
	const pendingQuestion = ref<Question | null>(null);
	const statusMessage = ref<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);

	// Question resolution
	let resolveQuestion: ((answer: string) => void) | null = null;

	function answerQuestion(answer: string) {
		pendingQuestion.value = null;
		resolveQuestion?.(answer);
		resolveQuestion = null;
	}

	function skipQuestion() {
		answerQuestion('(skipped)');
	}

	// Tool definitions
	const tools: ToolDefinition[] = [
		{
			name: 'write_file',
			description: 'Create or overwrite a file in the virtual filesystem',
			inputSchema: WriteFileInputSchema,
			execute: async (input) => {
				files.value = { ...files.value, [input.path]: input.content };
				return { success: true };
			},
		},
		{
			name: 'read_file',
			description: 'Read a file from the virtual filesystem',
			inputSchema: ReadFileInputSchema,
			execute: async (input) => {
				const content = files.value[input.path];

				if (content === undefined) {
					return { error: 'File not found' };
				}

				return { content };
			},
		},
		{
			name: 'rename_file',
			description: 'Rename or move a file',
			inputSchema: RenameFileInputSchema,
			execute: async (input) => {
				const content = files.value[input.from];

				if (content === undefined) {
					return { error: 'File not found' };
				}

				const newFiles = { ...files.value };
				delete newFiles[input.from];
				newFiles[input.to] = content;
				files.value = newFiles;
				return { success: true };
			},
		},
		{
			name: 'delete_file',
			description: 'Delete a file from the virtual filesystem',
			inputSchema: DeleteFileInputSchema,
			execute: async (input) => {
				if (files.value[input.path] === undefined) {
					return { error: 'File not found' };
				}

				const newFiles = { ...files.value };
				delete newFiles[input.path];
				files.value = newFiles;
				return { success: true };
			},
		},
		{
			name: 'list_files',
			description: 'List all files in the virtual filesystem',
			inputSchema: ListFilesInputSchema,
			execute: async () => {
				return { files: Object.keys(files.value) };
			},
		},
		{
			name: 'ask_question',
			description: 'Ask the user a clarifying question',
			inputSchema: AskQuestionInputSchema,
			execute: async (input) => {
				const question: Question = {
					question: input.question,
					inputType: input.input_type ?? 'text',
					options: input.options,
					context: input.context,
				};
				pendingQuestion.value = question;

				return new Promise<{ answer: string }>((resolve) => {
					resolveQuestion = (answer) => resolve({ answer });
				});
			},
		},
		{
			name: 'get_field_schema',
			description: 'Get field type, constraints, and relations for a field',
			inputSchema: GetFieldSchemaInputSchema,
			execute: async (input) => {
				const field = fieldsStore.getField(input.collection, input.field);

				if (!field) {
					return { error: 'Field not found' };
				}

				const relation = relationsStore.relations.find(
					(r) => r.collection === input.collection && r.field === input.field,
				);
				return {
					type: field.type,
					schema: field.schema ?? {},
					meta: field.meta ?? {},
					...(relation && { relation }),
				};
			},
		},
		{
			name: 'get_collection_fields',
			description: 'List all fields in a collection',
			inputSchema: GetCollectionFieldsInputSchema,
			execute: async (input) => {
				const collectionFields = fieldsStore.getFieldsForCollection(input.collection);
				return {
					fields: collectionFields.map((f) => ({
						field: f.field,
						type: f.type,
						name: f.name || f.field,
					})),
				};
			},
		},
		{
			name: 'set_config',
			description: 'Set the interface configuration (name, icon, types, etc.)',
			inputSchema: SetConfigInputSchema,
			execute: async (input) => {
				const parsed = ExtensionConfigSchema.safeParse(input);

				if (!parsed.success) {
					return { error: parsed.error.message };
				}

				config.value = parsed.data;
				return { success: true };
			},
		},
		{
			name: 'request_preview',
			description: 'Trigger compilation and check for errors',
			inputSchema: RequestPreviewInputSchema,
			execute: async (input) => {
				if (input.message) {
					statusMessage.value = { message: input.message, type: 'info' };
				}

				return options.onPreview();
			},
		},
		{
			name: 'show_status',
			description: 'Display a status message to the user',
			inputSchema: ShowStatusInputSchema,
			execute: async (input) => {
				statusMessage.value = { message: input.message, type: input.type ?? 'info' };
				return { success: true };
			},
		},
	];

	// Track if first message (for system prompt injection)
	let isFirstMessage = true;

	// Chat transport
	const transport = new DefaultChatTransport({
		api: '/ai/chat',
		credentials: 'include',
		body: () => ({
			provider: 'anthropic',
			model: 'claude-opus-4-5',
			tools: tools.map(toApiTool),
			toolApprovals: Object.fromEntries(tools.map((t) => [t.name, 'always'])),
		}),
	});

	// Chat instance
	const chat = new Chat<UIMessage>({
		transport,
		onToolCall: async ({ toolCall }) => {
			const tool = tools.find((t) => t.name === toolCall.toolName);

			if (!tool) {
				chat.addToolResult({
					tool: toolCall.toolName,
					state: 'output-error',
					errorText: `Unknown tool: ${toolCall.toolName}`,
					toolCallId: toolCall.toolCallId,
				});

				return;
			}

			try {
				const output = await tool.execute(toolCall.input as never);

				chat.addToolResult({
					tool: toolCall.toolName,
					output,
					toolCallId: toolCall.toolCallId,
				});
			}
			catch (error_) {
				chat.addToolResult({
					tool: toolCall.toolName,
					state: 'output-error',
					errorText: error_ instanceof Error ? error_.message : String(error_),
					toolCallId: toolCall.toolCallId,
				});
			}
		},
		sendAutomaticallyWhen: ({ messages: msgs }) =>
			lastAssistantMessageIsCompleteWithToolCalls({ messages: msgs }),
	});

	// Public API
	const messages = computed(() =>
		chat.messages.map((msg) => ({
			...msg,
			parts: [...(msg.parts ?? [])],
		})),
	);

	const status = computed(() => chat.status as 'idle' | 'streaming' | 'submitted' | 'error');
	const error = computed(() => chat.error);

	function send(text: string) {
		let messageText = text;

		// Prepend system prompt to first message
		if (isFirstMessage) {
			messageText = `[System Context]\n${SYSTEM_PROMPT}\n\n[User Request]\n${text}`;
			isFirstMessage = false;
		}

		chat.sendMessage({ text: messageText });
	}

	function stop() {
		chat.stop();
	}

	function retry() {
		chat.clearError();
		chat.regenerate();
	}

	function reset() {
		chat.clearError();
		chat.messages.splice(0, chat.messages.length);
		files.value = {};
		config.value = null;
		pendingQuestion.value = null;
		statusMessage.value = null;
		isFirstMessage = true;
	}

	return {
		messages,
		send,
		status,
		error,
		stop,
		retry,
		reset,
		files,
		config,
		pendingQuestion,
		statusMessage,
		answerQuestion,
		skipQuestion,
	} as UseAiGenerationReturn;
}
