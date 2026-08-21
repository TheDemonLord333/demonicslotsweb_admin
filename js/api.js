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
      throw new ApiError('Spieler wurde nicht gefunden.', {
        status: 404,
        code: 'not_found',
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

  getPlayers() {
    return this.#request('/api/admin/players');
  }

  getPlayer(username) {
    return this.#request(`/api/admin/players/${encodeURIComponent(username)}`);
  }

  updateBalance(username, balance) {
    return this.#request(`/api/admin/players/${encodeURIComponent(username)}/balance`, {
      method: 'PATCH',
      body: JSON.stringify({ balance }),
    });
  }
}
