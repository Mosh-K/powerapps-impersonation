export interface User {
  firstname: string
  lastname: string
  fullname: string
  internalemailaddress: string
  azureactivedirectoryobjectid: string
}

export interface TabStateEntry {
  orgBaseUrl: string | null
  hasPrivilege: boolean | null
  impersonation: User | null
  currentUser: User | null
}

export type BackgroundMessage =
  | { type: 'GET_TAB_STATE'; tabId: number }
  | { type: 'SEARCH_USERS'; orgBaseUrl: string; searchTerm: string }
  | { type: 'SET_IMPERSONATION'; tabId: number; user: User }
  | { type: 'CLEAR_IMPERSONATION'; tabId: number }

export type PopupMessage =
  | { type: 'PRIVILEGE_CHECKED'; tabId: number; orgBaseUrl: string | null; hasPrivilege: boolean; currentUser: User | null }
