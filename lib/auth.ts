import { siteOrigin } from '@/lib/site';

export const getAuthRedirectUrl = (path: string = '/auth/callback') => {
  return `${siteOrigin()}${path}`;
};

export const getAppUrl = (path: string = '') => `${siteOrigin()}${path}`;
