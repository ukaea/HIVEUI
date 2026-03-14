// src/app.d.ts
import { type Session, type User } from "better-auth";

declare global {
    namespace App {
        interface Locals {
            session: Session | null;
            user: (User & {
                groups: string[];
                accessToken: string;
                refreshToken: string;
                accessTokenExpiresAt: number;
            }) | null;
        }
    }
}

export {};