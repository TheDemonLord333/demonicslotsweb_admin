// api.js — thin client for the Demonic Slots Admin API.
// Backend is live and untouched by this project; see README for the contract.

export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code; // 'network' | 'unauthorized' | 'not_found' | 'server_error' | 'validation' | 'unknown' | 'parse_error'
  }
}

export class DemonicSlotsApi {
  constructor(baseUrl, token) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '');
    this.token = token;
  }

  async #request(path, options = {}) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      throw new ApiError(
        'Netzwerkfehler – Server nicht erreichbar. Prüfe die Backend-URL und deine Internetverbindung.',
        { code: 'network' }
      );
    }

    if (response.status === 401) {
      throw new ApiError('Ungültiger oder abgelaufener Admin-Token.', {
        status: 401,
        code: 'unauthorized',
      });
    }

    if (response.status === 404) {
      throw new ApiError('Spieler wurde nicht gefunden (evtl. wurde er zwischenzeitlich gelöscht).', {
        status: 404,
        code: 'not_found',
      });
    }

    if (response.status === 400 || response.status === 409) {
      let errorCode = '';
      try {
        const body = await response.json();
        errorCode = body && body.error ? body.error : '';
      } catch {
        /* ignore parse failure, fall back to a generic message below */
      }
      const messages = {
        invalid_username: 'Ungültiger Username (3–20 Zeichen: Buchstaben, Zahlen, „_“).',
        username_taken: 'Dieser Username ist bereits vergeben.',
        invalid_balance: 'Ungültiges Guthaben.',
      };
      throw new ApiError(messages[errorCode] || `Ungültige Anfrage${errorCode ? ` (${errorCode})` : ''}.`, {
        status: response.status,
        code: errorCode || 'validation',
      });
    }

    if (response.status === 500) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body && body.error ? body.error : '';
      } catch {
        /* ignore parse failure, fall back to generic message */
      }
      throw new ApiError(
        `Serverfehler${detail ? ` (${detail})` : ''}. Ist ADMIN_TOKEN auf dem Server konfiguriert?`,
        { status: 500, code: 'server_error' }
      );
    }

    if (!response.ok) {
      throw new ApiError(`Unerwarteter Fehler (Status ${response.status}).`, {
        status: response.status,
        code: 'unknown',
      });
    }

    if (response.status === 204) return null;

    try {
      return await response.json();
    } catch {
      throw new ApiError('Antwort des Servers konnte nicht gelesen werden.', {
        code: 'parse_error',
      });
    }
  }

  // All per-player endpoints address a player by their stable `id` (never
  // by `username`, which is just a mutable label the admin can rename).

  getPlayers() {
    return this.#request('/api/admin/players');
  }

  getPlayer(id) {
    return this.#request(`/api/admin/players/${encodeURIComponent(id)}`);
  }

  updateBalance(id, balance) {
    return this.#request(`/api/admin/players/${encodeURIComponent(id)}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ balance }),
    });
  }

  renameUsername(id, newUsername) {
    return this.#request(`/api/admin/players/${encodeURIComponent(id)}/username`, {
      method: 'PATCH',
      body: JSON.stringify({ username: newUsername }),
    });
  }
}
