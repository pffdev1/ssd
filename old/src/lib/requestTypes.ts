import { AppUser, RequestType } from "./types";

export const restrictedRequestTypeCodes = new Set(["PERSONNEL_REQUEST", "TERMINATION_REQUEST"]);

export function canAccessRequestType(requestType: Pick<RequestType, "code">, currentUser?: Pick<AppUser, "canManagePeopleFlows"> | null) {
  if (!restrictedRequestTypeCodes.has(requestType.code)) {
    return true;
  }

  return Boolean(currentUser?.canManagePeopleFlows);
}

export function filterRequestTypesForUser<T extends Pick<RequestType, "code">>(
  requestTypes: T[],
  currentUser?: Pick<AppUser, "canManagePeopleFlows"> | null
) {
  return requestTypes.filter((requestType) => canAccessRequestType(requestType, currentUser as Pick<AppUser, "canManagePeopleFlows">));
}
