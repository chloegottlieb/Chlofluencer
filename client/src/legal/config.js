/**
 * ✏️ Fill these in before you publish. They appear in the Privacy Policy,
 * Terms of Use and Community Guidelines. Anything still wrapped in [square
 * brackets] is highlighted in the app so you can't miss it.
 */
export const LEGAL = {
  appName: 'Storytime',
  companyName: '[Your Company Name, LLC]',
  companyAddress: '[Street address, City, State/Region, Postcode, Country]',
  privacyEmail: '[privacy@yourdomain.com]',
  supportEmail: '[support@yourdomain.com]',
  governingLaw: '[the State of Delaware, USA]',
  effectiveDate: 'September 25, 2026',
  minimumAge: 13,
};

export const isPlaceholder = (value) => /^\[.*\]$/.test(String(value));
