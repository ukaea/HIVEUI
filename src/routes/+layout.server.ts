import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) return { user: null };
	return {
		user: {
			name: locals.user.name,
			email: locals.user.email,
			groups: locals.user.groups
		}
	};
};
