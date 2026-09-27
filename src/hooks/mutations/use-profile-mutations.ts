import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/hooks/queries/query-keys';
import { useQueryScope } from '@/hooks/queries/query-scope';
import { api } from '@/services/api';
import type { CurrentUserResponse, UpdateCustomerProfilePayload, UpdateProfessionalProfilePayload } from '@/types/api';
import type { CustomerProfile, OwnProfessionalProfile, User } from '@/types/domain';

import { mergeDefined } from './cache-updates';
import { invalidateOwnProfile } from './invalidation';

type CustomerProfileData = { user: User; profile: CustomerProfile };

interface ProfessionalSnapshot {
  own: OwnProfessionalProfile | undefined;
  me: CurrentUserResponse | undefined;
}

/**
 * `PATCH /professional/profile` – optimistic: the own profile (and `/me`) update immediately and
 * roll back if the server rejects the change.
 */
export function useUpdateProfessionalProfile() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  const ownKey = queryKeys.professionals.own(userId);
  const meKey = queryKeys.auth.me(userId);

  const write = (update: (profile: OwnProfessionalProfile) => OwnProfessionalProfile) => {
    qc.setQueryData<OwnProfessionalProfile>(ownKey, (current) => (current ? update(current) : current));
    qc.setQueryData<CurrentUserResponse>(meKey, (current) =>
      current?.professionalProfile ? { ...current, professionalProfile: update(current.professionalProfile) } : current,
    );
  };

  return useMutation({
    mutationFn: (payload: UpdateProfessionalProfilePayload) => api.professionals.updateProfessionalProfile(payload),
    onMutate: async (payload): Promise<ProfessionalSnapshot> => {
      await Promise.all([qc.cancelQueries({ queryKey: ownKey }), qc.cancelQueries({ queryKey: meKey })]);
      const snapshot: ProfessionalSnapshot = {
        own: qc.getQueryData<OwnProfessionalProfile>(ownKey),
        me: qc.getQueryData<CurrentUserResponse>(meKey),
      };
      write((profile) => mergeDefined(profile, payload));
      return snapshot;
    },
    onError: (_error, _payload, snapshot) => {
      if (!snapshot) return;
      qc.setQueryData(ownKey, snapshot.own);
      qc.setQueryData(meKey, snapshot.me);
    },
    onSuccess: (profile) => write(() => profile),
    onSettled: () => {
      void invalidateOwnProfile(qc, userId);
    },
  });
}

interface CustomerSnapshot {
  profile: CustomerProfileData | undefined;
  me: CurrentUserResponse | undefined;
}

function applyCustomerPatch(data: CustomerProfileData, payload: UpdateCustomerProfilePayload): CustomerProfileData {
  const { firstName, lastName, phone, avatarUrl, defaultLocation, notificationPreferences } = payload;
  return {
    user: mergeDefined(data.user, { firstName, lastName, phone, avatarUrl }),
    profile: mergeDefined(data.profile, { defaultLocation, notificationPreferences }),
  };
}

/**
 * `PATCH /customer/profile` – optimistic as well (used for notification preference toggles), with
 * rollback on error.
 */
export function useUpdateCustomerProfile() {
  const qc = useQueryClient();
  const { userId } = useQueryScope();
  const profileKey = queryKeys.customer.profile(userId);
  const meKey = queryKeys.auth.me(userId);

  const write = (update: (data: CustomerProfileData) => CustomerProfileData) => {
    qc.setQueryData<CustomerProfileData>(profileKey, (current) => (current ? update(current) : current));
    qc.setQueryData<CurrentUserResponse>(meKey, (current) => {
      if (!current?.customerProfile) return current;
      const next = update({ user: current.user, profile: current.customerProfile });
      return { ...current, user: { ...next.user, role: 'customer' }, customerProfile: next.profile };
    });
  };

  return useMutation({
    mutationFn: (payload: UpdateCustomerProfilePayload) => api.customers.updateCustomerProfile(payload),
    onMutate: async (payload): Promise<CustomerSnapshot> => {
      await Promise.all([qc.cancelQueries({ queryKey: profileKey }), qc.cancelQueries({ queryKey: meKey })]);
      const snapshot: CustomerSnapshot = {
        profile: qc.getQueryData<CustomerProfileData>(profileKey),
        me: qc.getQueryData<CurrentUserResponse>(meKey),
      };
      write((data) => applyCustomerPatch(data, payload));
      return snapshot;
    },
    onError: (_error, _payload, snapshot) => {
      if (!snapshot) return;
      qc.setQueryData(profileKey, snapshot.profile);
      qc.setQueryData(meKey, snapshot.me);
    },
    onSuccess: (data) => write(() => data),
    onSettled: () => {
      void invalidateOwnProfile(qc, userId);
    },
  });
}
