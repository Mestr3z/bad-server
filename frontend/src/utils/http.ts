let csrf = ''
let csrfPromise: Promise<void> | null = null

async function loadCsrf() {
    const r = await fetch('/api/csrf-token', { credentials: 'include' })
    const j = await r.json()
    csrf = j.csrfToken
}

function ensureCsrf() {
    if (csrf) return Promise.resolve()
    if (!csrfPromise) csrfPromise = loadCsrf()
    return csrfPromise
}

export async function api(method: string, url: string, body?: any) {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
        await ensureCsrf()
        headers['X-CSRF-Token'] = csrf
    }
    const res = await fetch(`/api${url}`, {
        method,
        headers,
        credentials: 'include',
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return res
}
