import type { User, TabStateEntry, BackgroundMessage } from './types'

const tabState = new Map<number, TabStateEntry>()

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return
    const state = tabState.get(details.tabId)
    if (state?.orgBaseUrl) return

    const { protocol, hostname } = new URL(details.url)
    const orgBaseUrl = `${protocol}//${hostname}`

    tabState.set(details.tabId, { ...(state ?? emptyState()), orgBaseUrl })

    if (!state?.impersonation) {
      checkPrivilege(orgBaseUrl, details.tabId)
    }
  },
  { urls: ['*://*.dynamics.com/api/data/v*/*'] }
)

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'loading') return
  const state = tabState.get(tabId)
  if (!state?.impersonation) return
  chrome.action.setBadgeText({ text: getInitials(state.impersonation), tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#d83b01', tabId })
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const state = tabState.get(tabId)
  if (state?.impersonation) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {})
  }
  tabState.delete(tabId)
})

chrome.runtime.onMessage.addListener((message: BackgroundMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_TAB_STATE': {
      const state = tabState.get(message.tabId) ?? emptyState()
      sendResponse(state)
      return false
    }
    case 'SEARCH_USERS':
      searchUsers(message.orgBaseUrl, message.searchTerm)
        .then(users => sendResponse({ users }))
        .catch((err: Error) => sendResponse({ error: err.message }))
      return true
    case 'SET_IMPERSONATION':
      setImpersonation(message.tabId, message.user)
        .then(() => sendResponse({ success: true }))
        .catch((err: Error) => sendResponse({ error: err.message }))
      return true
    case 'CLEAR_IMPERSONATION':
      clearImpersonation(message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch((err: Error) => sendResponse({ error: err.message }))
      return true
  }
})

function emptyState(): TabStateEntry {
  return { orgBaseUrl: null, hasPrivilege: null, impersonation: null, currentUser: null }
}

async function dataverseGet(orgBaseUrl: string, path: string) {
  const response = await fetch(`${orgBaseUrl}/api/data/v9.2/${path}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function checkPrivilege(orgBaseUrl: string, tabId: number) {
  try {
    const whoAmI = await dataverseGet(orgBaseUrl, 'WhoAmI()')
    const userId: string = whoAmI.UserId

    const [userRecord, privileges] = await Promise.all([
      dataverseGet(orgBaseUrl, `systemusers(${userId})?$select=firstname,lastname,fullname,internalemailaddress`),
      dataverseGet(orgBaseUrl, `systemusers(${userId})/Microsoft.Dynamics.CRM.RetrieveUserPrivileges()`),
    ])

    const hasPrivilege: boolean = privileges.RolePrivileges?.some(
      (p: { PrivilegeName: string }) => p.PrivilegeName === 'prvActOnBehalfOfAnotherUser'
    ) ?? false

    const currentUser: User = {
      firstname: userRecord.firstname,
      lastname: userRecord.lastname,
      fullname: userRecord.fullname,
      internalemailaddress: userRecord.internalemailaddress,
      azureactivedirectoryobjectid: userRecord.azureactivedirectoryobjectid,
    }

    const state = tabState.get(tabId) ?? emptyState()
    tabState.set(tabId, { ...state, hasPrivilege, currentUser })

    chrome.runtime.sendMessage({ type: 'PRIVILEGE_CHECKED', tabId, orgBaseUrl, hasPrivilege, currentUser }).catch(() => {})
  } catch {
    const state = tabState.get(tabId) ?? emptyState()
    tabState.set(tabId, { ...state, hasPrivilege: false })

    chrome.runtime.sendMessage({ type: 'PRIVILEGE_CHECKED', tabId, orgBaseUrl, hasPrivilege: false, currentUser: null }).catch(() => {})
  }
}

async function searchUsers(orgBaseUrl: string, searchTerm: string): Promise<User[]> {
  const term = searchTerm.replace(/'/g, "''")
  const url =
    `${orgBaseUrl}/api/data/v9.2/systemusers` +
    `?$select=firstname,lastname,fullname,internalemailaddress,azureactivedirectoryobjectid` +
    `&$filter=azureactivedirectoryobjectid ne null` +
    ` and (contains(fullname,'${term}') or contains(internalemailaddress,'${term}'))` +
    `&$top=10`

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json()
  return data.value
}

function getInitials(user: User): string {
  const f = [...(user.firstname ?? '')][0] ?? ''
  const l = [...(user.lastname ?? '')][0] ?? ''
  return (f + l).toUpperCase() || '?'
}

async function setImpersonation(tabId: number, user: User) {
  // @types/chrome types this as void but Chrome returns Promise<void> at runtime
  await (chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: [{
      id: tabId,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: [{ header: 'CallerObjectId', operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: user.azureactivedirectoryobjectid }],
      },
      condition: {
        urlFilter: '||dynamics.com/api/data/v',
        tabIds: [tabId],
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST, chrome.declarativeNetRequest.ResourceType.OTHER],
      },
    }],
  }) as unknown as Promise<void>)

  const state = tabState.get(tabId) ?? emptyState()
  tabState.set(tabId, { ...state, impersonation: user })

  chrome.action.setBadgeText({ text: getInitials(user), tabId })
  chrome.action.setBadgeBackgroundColor({ color: '#d83b01', tabId })
  chrome.tabs.reload(tabId)
}

async function clearImpersonation(tabId: number) {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {})

  const state = tabState.get(tabId) ?? emptyState()
  tabState.set(tabId, { ...state, impersonation: null })

  chrome.action.setBadgeText({ text: '', tabId })
  chrome.tabs.reload(tabId)
}
