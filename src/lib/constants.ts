/**
 * System-wide default emergency response phone number, used to pre-fill
 * the manifest form's emergency phone fields unless a user has saved
 * their own preference in Settings (see epaService.ts /
 * getDefaultEmergencyPhone). Per-manifest, it's still a normal editable
 * field — this is only the starting value.
 */
export const SYSTEM_DEFAULT_EMERGENCY_PHONE = "800-348-5816"; // SMR Rapid Response
