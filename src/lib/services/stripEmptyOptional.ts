import Zod from 'zod';

function unwrap(schema: Zod.ZodType): Zod.ZodType {
	let current: any = schema;
	while (
		current instanceof Zod.ZodOptional ||
		current instanceof Zod.ZodNullable ||
		current instanceof Zod.ZodDefault
	) {
		current = current.unwrap();
	}
	return current;
}

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string') return value.trim() === '';
	if (typeof value === 'object' && !Array.isArray(value)) return Object.keys(value).length === 0;
	return false;
}

/**
 * Removes empty fields (null, undefined, blank string or empty object) unless the schema
 * requires them, i.e. rejects the field's empty value. Fields without a schema are not required.
 */
export function stripEmptyOptional(data: any, schema?: Zod.ZodType): any {
	if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;

	const objectSchema = schema ? unwrap(schema) : undefined;
	const shape: Record<string, Zod.ZodType> =
		objectSchema instanceof Zod.ZodObject ? objectSchema.shape : {};
	const result: Record<string, any> = {};

	for (const [key, value] of Object.entries(data)) {
		const fieldSchema = shape[key];
		const cleaned = stripEmptyOptional(value, fieldSchema);
		const required = fieldSchema ? !fieldSchema.safeParse(value).success : false;
		if (isEmpty(cleaned) && !required) continue;
		result[key] = cleaned;
	}

	return result;
}
