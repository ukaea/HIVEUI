import type { ComponentProps } from 'svelte';
import type { Form } from 'svelte-ux';
import type { ZodType, infer as Infer } from 'zod';

// svelte-ux types `schema` against its own bundled zod v3; the runtime only needs `safeParse`, which zod v4 provides.
type SvelteUxSchema = NonNullable<ComponentProps<Form>['schema']>;

export type FormErrors<T> = {
	[K in keyof T]?: NonNullable<T[K]> extends Date | unknown[] | string | number | boolean
		? string
		: FormErrors<NonNullable<T[K]>>;
};

export function formSchema(schema: ZodType) {
	return schema as unknown as SvelteUxSchema;
}

// svelte-ux types slot `errors` as flat, but it is nested by issue path at runtime.
export function formErrors<S extends ZodType>(_schema: S, errors: Record<string, string>) {
	return errors as unknown as FormErrors<Infer<S>>;
}
