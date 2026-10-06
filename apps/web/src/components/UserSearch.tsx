import { useState, useRef } from "react";
import type { PublicUser } from "@secure-chat/shared";
import { api } from "../api";
import { Avatar } from "./Avatar";

interface UserSearchProps {
  onSelectUser: (user: PublicUser) => void;
}

export function UserSearch({ onSelectUser }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<number>();

  const handleInputChange = (val: string) => {
    setQuery(val);
    window.clearTimeout(debounceTimer.current);

    if (!val.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = window.setTimeout(async () => {
      try {
        const response = await api.search(val);
        setResults(response.users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const handleSelect = (user: PublicUser) => {
    setQuery("");
    setResults([]);
    onSelectUser(user);
  };

  return (
    <div className="user-search-container">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Search by name or @username…"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="search-clear-btn"
            onClick={() => handleInputChange("")}
            title="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {loading && (
        <div className="search-status muted small">
          Searching…
        </div>
      )}

      {results.length > 0 && (
        <div className="search-results-list">
          {results.map((user) => (
            <button
              key={user.id}
              className="search-result-item"
              type="button"
              onClick={() => handleSelect(user)}
            >
              <Avatar user={user} size="sm" showStatus />
              <div className="search-result-info">
                <strong>{user.name}</strong>
                <small className="muted">@{user.username}</small>
              </div>
              <span className="search-result-action">Chat</span>
            </button>
          ))}
        </div>
      )}

      {query.trim().length > 0 && !loading && results.length === 0 && (
        <div className="search-status muted small">
          No users found matching "{query}"
        </div>
      )}
    </div>
  );
}
