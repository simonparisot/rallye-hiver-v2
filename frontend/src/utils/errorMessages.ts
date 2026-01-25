/**
 * Translate backend error messages from English to French
 */

const errorTranslations: Record<string, string> = {
  // Auth errors
  'User account already exists': 'Un compte avec cet email existe déjà',
  'Invalid email or password': 'Email ou mot de passe incorrect',
  'User not found': 'Utilisateur introuvable',
  'Invalid credentials': 'Identifiants invalides',
  'Email already exists': 'Cet email est déjà utilisé',
  'Password must be at least 8 characters': 'Le mot de passe doit contenir au moins 8 caractères',
  'Password must contain uppercase, lowercase, and number': 'Le mot de passe doit contenir une majuscule, une minuscule et un chiffre',

  // Team errors
  'Team not found': 'Équipe introuvable',
  'Team name already exists': 'Ce nom d\'équipe existe déjà',
  'User already in a team': 'Vous êtes déjà dans une équipe',
  'Not a team member': 'Vous n\'êtes pas membre de cette équipe',
  'Only team leader can perform this action': 'Seul le chef d\'équipe peut effectuer cette action',
  'Team already paid': 'Cette équipe a déjà payé',
  'Team has not paid': 'Cette équipe n\'a pas encore payé',
  'Cannot leave team after payment': 'Impossible de quitter l\'équipe après paiement',

  // Request errors
  'Join request not found': 'Demande de rejoindre introuvable',
  'Join request already exists': 'Une demande pour rejoindre cette équipe existe déjà',
  'User already requested to join this team': 'Vous avez déjà demandé à rejoindre cette équipe',

  // Game errors
  'Game has not started': 'Le jeu n\'a pas encore commencé',
  'Enigma not found': 'Énigme introuvable',
  'Parcours not found': 'Parcours introuvable',
  'Invalid answer': 'Réponse incorrecte',
  'Enigma already solved': 'Cette énigme a déjà été résolue',
  'Parcours already completed': 'Ce parcours a déjà été complété',

  // Payment errors
  'Payment failed': 'Le paiement a échoué',
  'Invalid payment session': 'Session de paiement invalide',

  // Generic errors
  'Unauthorized': 'Non autorisé',
  'Forbidden': 'Accès refusé',
  'Not found': 'Ressource introuvable',
  'Internal server error': 'Erreur serveur interne',
  'Bad request': 'Requête invalide',
  'Validation error': 'Erreur de validation',
};

/**
 * Translate an error message from English to French
 * Returns the original message if no translation is found
 */
export function translateError(errorMessage: string): string {
  // Direct match
  if (errorTranslations[errorMessage]) {
    return errorTranslations[errorMessage];
  }

  // Try to find a partial match (case-insensitive)
  const lowerMessage = errorMessage.toLowerCase();
  for (const [key, value] of Object.entries(errorTranslations)) {
    if (lowerMessage.includes(key.toLowerCase())) {
      return value;
    }
  }

  // Return original message if no translation found
  return errorMessage;
}

/**
 * Extract and translate error message from an axios error
 */
export function getErrorMessage(error: any, fallbackMessage: string = 'Une erreur est survenue'): string {
  const backendError = error.response?.data?.error;

  if (backendError) {
    return translateError(backendError);
  }

  return fallbackMessage;
}
