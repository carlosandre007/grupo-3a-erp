import { validateMasterPassword, validateOwnerMasterPassword } from './adminActions';

export type ValidationResult = { valid: boolean; configured: boolean; message: string };

const failure = (reason: unknown, fallback: string): ValidationResult => ({
  valid: false,
  configured: true,
  message: reason instanceof Error ? reason.message : fallback,
});

export const validateAdministrativePassword = async (password: string): Promise<ValidationResult> => {
  try {
    await validateMasterPassword(password);
    return { valid: true, configured: true, message: 'Acesso autorizado.' };
  } catch (reason) {
    return failure(reason, 'Autorização recusada.');
  }
};

export const validateOwnerPassword = async (password: string): Promise<ValidationResult> => {
  try {
    await validateOwnerMasterPassword(password);
    return { valid: true, configured: true, message: 'Acesso de proprietário autorizado.' };
  } catch (reason) {
    return failure(reason, 'Acesso restrito ao proprietário.');
  }
};
