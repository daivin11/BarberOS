export const PRIVACY_CONSENT_VERSION = "2026-08-05";

export const createPrivacyConsentSnapshot = ({ accepted, acceptedAt = new Date() } = {}) => ({
  privacyConsent: accepted === true,
  privacyConsentVersion: PRIVACY_CONSENT_VERSION,
  privacyConsentAt: acceptedAt,
});

export const isPrivacyConsentAccepted = (value) => value === true;
