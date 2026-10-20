export const METACAT_OWNER_GROUP = 'HIVE';
export const METACAT_ACCESS_GROUPS = ['HIVE'];

export function withMetacatGroups<T extends Record<string, any>>(data: T): T {
    return { ...data, ownerGroup: METACAT_OWNER_GROUP, accessGroups: [...METACAT_ACCESS_GROUPS] };
}
