import { login as serviceLogin, logout as serviceLogout, isAuthenticated as serviceIsAuthenticated, getCurrentUser as serviceGetCurrentUser, renewSession as serviceRenewSession } from "@/services/authService";
import type { LoginCredentials, LoginResult, User } from "@/types";

/**
 * Auth Library Wrapper
 * Re-exports functionality from authService to maintain compatibility
 * and ensure a single source of truth for authentication logic.
 */

export const login = serviceLogin;
export const logout = serviceLogout;
export const isAuthenticated = serviceIsAuthenticated;
export const getCurrentUser = serviceGetCurrentUser;
export const renewSession = serviceRenewSession;