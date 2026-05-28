import type { SessionData } from '$lib/server/auth';

declare global {
	namespace App {
		interface Locals {
			user: SessionData | null;
		}
	}
}

export {};
