// src/app.d.ts
import { type Session, type User } from "better-auth";

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
            session: Session | null;
            // Extend the User type to include your custom group field
            user: (User & { groups: string[] | null | undefined})| null;
        }
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};