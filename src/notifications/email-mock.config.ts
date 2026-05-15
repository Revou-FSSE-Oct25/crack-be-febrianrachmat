export function isEmailMockEnabled(): boolean {
  if (process.env.EMAIL_MOCK_ENABLED === 'false') {
    return false;
  }
  if (process.env.EMAIL_MOCK_ENABLED === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}
