/** Dashboard controllers. */
import type { Request } from 'express';

import type { AppDeps } from '../../deps.js';
import { authOf } from '../../middleware/auth.js';
import { getCustomerDashboard } from './customer-dashboard.service.js';
import { getProfessionalDashboard } from './professional-dashboard.service.js';

/** `GET /v1/customer/dashboard` → `CustomerDashboard` */
export const customer = () => (req: Request) => getCustomerDashboard(authOf(req, 'customer'));

/** `GET /v1/professional/dashboard` → `ProfessionalDashboard` */
export const professional = (deps: AppDeps) => (req: Request) => getProfessionalDashboard(deps, authOf(req, 'professional'));
