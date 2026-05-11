import { useState, useEffect, useCallback, useRef } from 'react'
import type { User, TabStateEntry, PopupMessage } from '../types'

const VALID_HOSTS = ['.powerapps.com', '.dynamics.com']

type UIState = 'inactive' | 'waiting' | 'checking' | 'no-privilege' | 'ready'

function isValidTabUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return VALID_HOSTS.some(h => hostname.endsWith(h))
  } catch {
    return false
  }
}

function deriveUIState(tabValid: boolean, state: TabStateEntry | null): UIState {
  if (!tabValid) return 'inactive'
  if (!state?.orgBaseUrl) return 'waiting'
  if (state.hasPrivilege === null) return 'checking'
  return state.hasPrivilege ? 'ready' : 'no-privilege'
}

export function App() {
  const [currentTabId, setCurrentTabId] = useState<number | null>(null)
  const [tabValid, setTabValid] = useState(false)
  const [tabState, setTabState] = useState<TabStateEntry | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const uiState = deriveUIState(tabValid, tabState)

  useEffect(() => {
    async function init() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return

      setCurrentTabId(tab.id)

      const valid = isValidTabUrl(tab.url ?? '')
      setTabValid(valid)
      if (!valid) return

      const state: TabStateEntry = await chrome.runtime.sendMessage({ type: 'GET_TAB_STATE', tabId: tab.id })
      setTabState(state)
    }
    init()
  }, [])

  useEffect(() => {
    const listener = (message: PopupMessage) => {
      if (message.tabId !== currentTabId) return
      if (message.type === 'PRIVILEGE_CHECKED') {
        setTabState(prev => ({
          ...(prev ?? { impersonation: null, currentUser: null }),
          orgBaseUrl: message.orgBaseUrl,
          hasPrivilege: message.hasPrivilege,
          currentUser: message.currentUser,
        }))
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [currentTabId])

  const doSearch = useCallback(async (term: string) => {
    if (!term || term.length < 2 || !tabState?.orgBaseUrl) {
      setResults([])
      setSearchError(null)
      return
    }

    setSearching(true)
    setSearchError(null)

    const response = await chrome.runtime.sendMessage({
      type: 'SEARCH_USERS',
      orgBaseUrl: tabState.orgBaseUrl,
      searchTerm: term,
    })

    setSearching(false)

    if (response.error) {
      setSearchError(response.error)
    } else {
      setResults(response.users)
    }
  }, [tabState?.orgBaseUrl])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const term = e.target.value
    setSearchTerm(term)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(term.trim()), 300)
  }

  async function selectUser(user: User) {
    if (!currentTabId) return
    const response = await chrome.runtime.sendMessage({ type: 'SET_IMPERSONATION', tabId: currentTabId, user })
    if (response.success) {
      window.close()
    }
  }

  function clearImpersonation() {
    if (!currentTabId) return
    chrome.runtime.sendMessage({ type: 'CLEAR_IMPERSONATION', tabId: currentTabId })
    window.close()
  }

  return (
    <div id="app">
      <header>
        <span className="header-title">PowerApps Impersonation</span>
      </header>

      {uiState === 'inactive' && (
        <div className="state">
          <p className="status-message">Open a PowerApps or Dynamics 365 tab to activate.</p>
        </div>
      )}
      {uiState === 'waiting' && (
        <div className="state">
          <p className="status-message">Waiting for an API request from this tab...</p>
        </div>
      )}
      {uiState === 'checking' && (
        <div className="state">
          <p className="status-message">Checking permissions...</p>
        </div>
      )}
      {uiState === 'no-privilege' && (
        <div className="state">
          <p className="status-message status-error">
            Your account does not have the <strong>Act on Behalf of Another User</strong> privilege.
            Contact your system administrator.
          </p>
        </div>
      )}
      {uiState === 'ready' && !tabState?.impersonation && (
        <div className="state">
          <div className="search-wrapper">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name or email..."
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </div>
          <div id="search-results">
            {searching && <div className="results-loading">Searching...</div>}
            {searchError && <div className="results-error">Error: {searchError}</div>}
            {!searching && !searchError && results.length === 0 && searchTerm.length >= 2 && (
              <div className="results-empty">No users found.</div>
            )}
            {!searching && results.map(user => (
              <div
                key={user.azureactivedirectoryobjectid}
                className="result-item"
                onClick={() => selectUser(user)}
              >
                <span className="result-name">{user.fullname}</span>
                <span className="result-email">{user.internalemailaddress}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tabState?.impersonation && (
        <div id="active-bar">
          <div className="active-info">
            <span className="active-label">Impersonating</span>
            <span className="active-name">{tabState.impersonation.fullname}</span>
            <span className="active-email">{tabState.impersonation.internalemailaddress}</span>
          </div>
          <button id="clear-btn" title="Stop impersonating" onClick={clearImpersonation}>✕</button>
        </div>
      )}
    </div>
  )
}
