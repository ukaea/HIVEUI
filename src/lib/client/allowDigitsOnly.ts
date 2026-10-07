export function allowDigitsOnly(e: KeyboardEvent) {
	if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) {
		e.preventDefault();
	}
}
