# Authentication & Authorization Architecture

CampusLoom employs a modern, robust, and scalable authentication strategy built for Day 1 frontend readiness and Day 2 backend integration. The system focuses on **security, clean abstraction, and scalability** for Role-Based Access Control (RBAC).

## Architecture Overview

### 1. Auth State Management (`AuthContext.jsx`)
Global authentication state is handled natively via React Context API (`src/features/auth/AuthContext.jsx`). This provides `<AuthProvider>` around the routing layer to track:
- `user`: Currently authenticated user object (includes `role`).
- `isAuthenticated`: Boolean denoting active session.
- `isLoading`: Boolean denoting token validation status.
- `login(email, password)`: Authenticator function.
- `logout()`: Cleans up session safely.

### 2. Token Storage Strategy (`src/lib/auth.js`)
We use an abstraction layer over native Web Storage. Currently, the implementation relies on `localStorage` to securely store the JWT token under a distinct key (`campusloom_access_token`). 

> [!TIP]
> **Future Upgrade Path:** Because the token handling is completely abstracted into `getToken`, `setToken`, and `removeToken`, transitioning to an `HttpOnly` cookie-based approach or in-memory volatile tokens will require **zero changes** to components or API interceptors.

### 3. API Interceptor Layer (`src/lib/api.js`)
Axios interceptors are configured to:
1. **Request Interceptor**: Auto-attach the Bearer token via `getToken()` if it exists.
2. **Response Interceptor**: Catch globally thrown `401 Unauthorized` errors triggered by expired or invalid tokens. It auto-invokes `removeToken()` and hard redirects to `/login`.

### 4. Protected Routes (`ProtectedRoute.jsx`)
Administrative and sensitive dashboard modules are protected by `ProtectedRoute`. 
- **Validation Check**: It pauses render while `isLoading` is true (validating token on app mount).
- **Unauthorized Handling**: Immediately uses `react-router-dom`'s `<Navigate to="/login" replace />` for unauthenticated requests, forwarding their original intent location in the `state` prop.
- **RBAC Prepared**: Accepts an `allowedRoles` prop for future access segregation (e.g., locking routes to strictly `superadmin`).

## Form & UI Structure

The Admin Entry portal (`/login`) ensures strict data hygiene before hitting the backend:
- Relies on **react-hook-form** for predictable performance and avoid deep re-renders on keystrokes.
- Validates purely through **Zod**, guaranteeing correct types and email string formatting.
- Fully features animated Loading states (`Loader2`) and Error notifications (`AlertCircle`).

## Future Implementations

- **Real API Endpoints**: Swap the mocked timeout inside `AuthContext.jsx#login` with a true `api.post('/auth/login')`.
- **JWT Decoding**: Upon login, decode the returned token using `jwt-decode` to extract expiration time or injected user roles dynamically without extra `/auth/me` calls.
- **Refresh Tokens**: When HTTP 401 triggers, the axios interceptor could pause the request queue, attempt a `/auth/refresh` call, inject the new token, and resume original requests.
