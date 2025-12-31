// schemas.ts
import { z } from 'zod/v4';

// ============================================
// Shared Schemas
// ============================================

export const FieldTypeSchema = z.enum([
	'string',
	'text',
	'integer',
	'bigInteger',
	'float',
	'decimal',
	'boolean',
	'json',
	'uuid',
	'hash',
	'csv',
	'dateTime',
	'date',
	'time',
	'timestamp',
	'geometry',
]);

export const InterfaceGroupSchema = z.enum([
	'standard',
	'selection',
	'relational',
	'presentation',
	'group',
	'other',
]);

export const OptionFieldSchema = z.object({
	field: z.string(),
	name: z.string(),
	type: z.string(),
	meta: z.object({
		interface: z.string(),
		width: z.enum(['half', 'full']).optional(),
		options: z.record(z.string(), z.unknown()).optional(),
	}),
	schema: z.object({
		default_value: z.unknown().optional(),
	}).optional(),
});

export const ExtensionConfigSchema = z.object({
	name: z.string(),
	icon: z.string(),
	description: z.string().max(80),
	types: z.array(FieldTypeSchema),
	group: InterfaceGroupSchema.default('standard'),
	options: z.array(OptionFieldSchema).default([]),
});

// ============================================
// Tool Input Schemas
// ============================================

export const WriteFileInputSchema = z.object({
	path: z.string().describe('File path, e.g. "index.vue"'),
	content: z.string().describe('File content'),
});

export const ReadFileInputSchema = z.object({
	path: z.string().describe('File path to read'),
});

export const RenameFileInputSchema = z.object({
	from: z.string().describe('Current file path'),
	to: z.string().describe('New file path'),
});

export const DeleteFileInputSchema = z.object({
	path: z.string().describe('File path to delete'),
});

export const ListFilesInputSchema = z.object({});

export const AskQuestionInputSchema = z.object({
	question: z.string().describe('Question to ask the user'),
	input_type: z.enum(['text', 'select', 'collection', 'field']).default('text'),
	options: z.array(z.string()).optional().describe('Options for select input'),
	context: z.object({
		collection: z.string().optional().describe('Collection for field picker'),
	}).optional(),
});

export const GetFieldSchemaInputSchema = z.object({
	collection: z.string(),
	field: z.string(),
});

export const GetCollectionFieldsInputSchema = z.object({
	collection: z.string(),
});

export const SetConfigInputSchema = ExtensionConfigSchema;

export const RequestPreviewInputSchema = z.object({
	message: z.string().optional().describe('Optional message to display'),
});

export const ShowStatusInputSchema = z.object({
	message: z.string().describe('Status message to display'),
	type: z.enum(['info', 'success', 'warning']).default('info'),
});

// ============================================
// Tool Output Schemas
// ============================================

export const ReadFileOutputSchema = z.object({
	content: z.string().optional(),
	error: z.string().optional(),
});

export const ListFilesOutputSchema = z.object({
	files: z.array(z.string()),
});

export const AskQuestionOutputSchema = z.object({
	answer: z.string(),
});

export const GetFieldSchemaOutputSchema = z.object({
	type: z.string(),
	schema: z.record(z.any()),
	meta: z.record(z.any()),
	relation: z.record(z.any()).optional(),
});

export const GetCollectionFieldsOutputSchema = z.object({
	fields: z.array(z.object({
		field: z.string(),
		type: z.string(),
		name: z.string(),
	})),
});

export const RequestPreviewOutputSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
});

// ============================================
// Inferred Types
// ============================================

export type FieldType = z.infer<typeof FieldTypeSchema>;
export type InterfaceGroup = z.infer<typeof InterfaceGroupSchema>;
export type OptionField = z.infer<typeof OptionFieldSchema>;
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;

export type WriteFileInput = z.infer<typeof WriteFileInputSchema>;
export type ReadFileInput = z.infer<typeof ReadFileInputSchema>;
export type ReadFileOutput = z.infer<typeof ReadFileOutputSchema>;
export type RenameFileInput = z.infer<typeof RenameFileInputSchema>;
export type DeleteFileInput = z.infer<typeof DeleteFileInputSchema>;
export type ListFilesOutput = z.infer<typeof ListFilesOutputSchema>;
export type AskQuestionInput = z.infer<typeof AskQuestionInputSchema>;
export type AskQuestionOutput = z.infer<typeof AskQuestionOutputSchema>;
export type GetFieldSchemaInput = z.infer<typeof GetFieldSchemaInputSchema>;
export type GetFieldSchemaOutput = z.infer<typeof GetFieldSchemaOutputSchema>;
export type GetCollectionFieldsInput = z.infer<typeof GetCollectionFieldsInputSchema>;
export type GetCollectionFieldsOutput = z.infer<typeof GetCollectionFieldsOutputSchema>;
export type SetConfigInput = z.infer<typeof SetConfigInputSchema>;
export type RequestPreviewInput = z.infer<typeof RequestPreviewInputSchema>;
export type RequestPreviewOutput = z.infer<typeof RequestPreviewOutputSchema>;
export type ShowStatusInput = z.infer<typeof ShowStatusInputSchema>;
