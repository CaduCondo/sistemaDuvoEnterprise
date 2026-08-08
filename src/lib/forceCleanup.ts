/**
 * Force cleanup utility
 * Clears ALL authentication and session data
 */

/**
 * Force logout and cleanup
 */
export async function forceLogout(): Promise<void> {
  try {
    console.log("🧹 Iniciando limpeza forçada...");

    // 1. Clear localStorage
    localStorage.clear();

    // 2. Clear sessionStorage
    sessionStorage.clear();

    console.log("✅ Limpeza concluída");
  } catch (error) {
    console.error("❌ Erro durante limpeza:", error);
  }
}

/**
 * Clear all auth-related data
 */
export function clearAuthData(): void {
  const authKeys = [
    "auth_session",
    "auth_user",
    "supabase.auth.token",
    "sb-auth-token",
  ];

  authKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });

  console.log("✅ Dados de autenticação limpos");
}

/**
 * Force cleanup of dialog overlays and focus traps
 * Use this when dialogs close to prevent pointer-events blocking
 */
export function forceDialogCleanup(): void {
  console.log("🧹 Forçando limpeza de overlays de diálogo...");
  
  // Remove active element focus
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  
  // Find and remove ALL Radix dialog overlays
  const overlays = document.querySelectorAll('[data-radix-dialog-overlay]');
  overlays.forEach(overlay => {
    if (overlay instanceof HTMLElement) {
      overlay.remove();
    }
  });
  
  // Find and remove ALL Radix focus guards
  const focusGuards = document.querySelectorAll('[data-radix-focus-guard]');
  focusGuards.forEach(guard => {
    if (guard instanceof HTMLElement) {
      guard.remove();
    }
  });
  
  // Clean up Radix portals without open dialogs
  const portals = document.querySelectorAll('[data-radix-portal]');
  portals.forEach(portal => {
    const hasOpenDialog = portal.querySelector('[data-state="open"]');
    if (!hasOpenDialog) {
      if (portal instanceof HTMLElement) {
        portal.remove();
      }
    }
  });
  
  // Force reset body styles
  document.body.style.pointerEvents = '';
  document.body.style.overflow = '';
  document.body.removeAttribute('data-scroll-locked');
  
  // Reset pointer-events on all elements (except disabled ones)
  const allElements = document.querySelectorAll('*');
  allElements.forEach(el => {
    if (el instanceof HTMLElement && 
        el.style.pointerEvents === 'none' && 
        !el.hasAttribute('disabled') &&
        !el.hasAttribute('aria-hidden')) {
      el.style.pointerEvents = '';
    }
  });
  
  console.log("✅ Limpeza de overlays concluída");
}