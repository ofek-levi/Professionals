import { common } from './common';
import { errors } from './errors';
import { validation } from './validation';
import { auth } from './auth';
import { settings } from './settings';
import { legal } from './legal';
import { location } from './location';
import { customer } from './customer';
import { requests } from './requests';
import { offers } from './offers';
import { reviews } from './reviews';
import { profile } from './profile';
import { professional } from './professional';
import { explore } from './explore';
import { jobs } from './jobs';
import { notifications } from './notifications';
import { messaging } from './messaging';

export const he = {
  common,
  errors,
  validation,
  auth,
  settings,
  legal,
  location,
  customer,
  requests,
  offers,
  reviews,
  profile,
  professional,
  explore,
  jobs,
  notifications,
  messaging,
} as const;
