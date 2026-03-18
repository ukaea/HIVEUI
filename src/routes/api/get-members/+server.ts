import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

interface KeycloakTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

interface KeycloakUser {
    id: string;
    username: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
}

interface KeycloakGroup {
    id: string;
    name: string;
    path: string;
    subGroups?: KeycloakGroup[];
}

export const GET: RequestHandler = async ({ url }) => {
    try {
        // 1. Get Group Name from frontend query param
        const groupName = url.searchParams.get('group');

        if (!groupName) {
            return json(
                { success: false, message: 'Group name is required' },
                { status: 400 }
            );
        }

        // 2. Validate environment variables
        if (
            !env.AUTH_KEYCLOAK_ISSUER ||
            !env.AUTH_KEYCLOAK_ID ||
            !env.AUTH_KEYCLOAK_SECRET ||
            !env.AUTH_KEYCLOAK_SERVICE_USERNAME ||
            !env.AUTH_KEYCLOAK_SERVICE_PASSWORD
        ) {
            console.error('Missing Keycloak configuration');
            return json(
                { success: false, message: 'Keycloak configuration is incomplete' },
                { status: 500 }
            );
        }

        const issuerUrl = new URL(env.AUTH_KEYCLOAK_ISSUER);
        const pathParts = issuerUrl.pathname.split('/');
        const realmIndex = pathParts.indexOf('realms');
        
        if (realmIndex === -1 || realmIndex === pathParts.length - 1) {
            return json(
                { success: false, message: 'Invalid Keycloak issuer URL format' },
                { status: 500 }
            );
        }

        const realm = pathParts[realmIndex + 1];
        const keycloakBaseUrl = `${issuerUrl.protocol}//${issuerUrl.host}`;

        // 3. Get access token (Direct Grant flow)
        const tokenUrl = `${keycloakBaseUrl}/realms/${realm}/protocol/openid-connect/token`;
        const tokenParams = new URLSearchParams({
            grant_type: 'password',
            client_id: env.AUTH_KEYCLOAK_ID,
            client_secret: env.AUTH_KEYCLOAK_SECRET,
            username: env.AUTH_KEYCLOAK_SERVICE_USERNAME,
            password: env.AUTH_KEYCLOAK_SERVICE_PASSWORD,
        });

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams,
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Failed to get Keycloak access token:', errorText);
            return json(
                { success: false, message: 'Failed to authenticate with Keycloak' },
                { status: 500 }
            );
        }

        const tokenData: KeycloakTokenResponse = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 4. Lookup Group ID by Name
        // Endpoint: /admin/realms/{realm}/groups?search={name}
        const groupSearchUrl = new URL(`${keycloakBaseUrl}/admin/realms/${realm}/groups`);
        groupSearchUrl.searchParams.append('search', groupName);

        const groupSearchResponse = await fetch(groupSearchUrl.toString(), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!groupSearchResponse.ok) {
            const errorText = await groupSearchResponse.text();
            console.error(`Failed to search for group '${groupName}':`, errorText);
            return json(
                { success: false, message: 'Failed to search for group' },
                { status: 500 }
            );
        }

        const groupsFound: KeycloakGroup[] = await groupSearchResponse.json();

        // 4.1 Filter for exact match
        // The search API is fuzzy (substring match), so we filter to be safe.
        // Note: This logic assumes the group is at the top level of the search results.
        const targetGroup = groupsFound.find(g => g.name === groupName);

        if (!targetGroup) {
            return json(
                { success: false, message: `Group '${groupName}' not found` },
                { status: 404 }
            );
        }

        const groupId = targetGroup.id;

        // 5. Fetch Group Members using the ID found
        const membersUrl = new URL(
            `${keycloakBaseUrl}/admin/realms/${realm}/groups/${groupId}/members`
        );
        
        const membersResponse = await fetch(membersUrl.toString(), {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!membersResponse.ok) {
            const errorText = await membersResponse.text();
            console.error(`Failed to fetch members for group ID ${groupId}:`, errorText);
            return json(
                { success: false, message: 'Failed to fetch group members' },
                { status: 500 }
            );
        }

        const users: KeycloakUser[] = await membersResponse.json();

        // 6. Transform the data
        const members = users.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email || '',
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            enabled: user.enabled,
        }));

        return json({
            success: true,
            members,
            count: members.length,
        });

    } catch (error) {
        console.error('Error fetching members from Keycloak:', error);
        return json(
            { 
                success: false, 
                message: error instanceof Error ? error.message : 'Error fetching members' 
            },
            { status: 500 }
        );
    }
};