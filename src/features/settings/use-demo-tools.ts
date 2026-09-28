import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { demoTools } from '@/services/api';

import { settingsStore, useSettings } from './settings-store';

/** Share of requests that fail while "unreliable network" is on. */
const SIMULATED_FAILURE_RATE = 0.2;

interface DemoToolsState {
  /** Demo tools only exist with the in-app mock backend. */
  isAvailable: boolean;
  simulationEnabled: boolean;
  setSimulationEnabled: (enabled: boolean) => void;
  networkFailuresEnabled: boolean;
  setNetworkFailuresEnabled: (enabled: boolean) => void;
  /** Re-seeds the mock database and refreshes every cached query. */
  resetDemoData: () => Promise<void>;
}

export function useDemoTools(): DemoToolsState {
  const queryClient = useQueryClient();
  const { simulationEnabled } = useSettings();
  const [networkFailuresEnabled, setNetworkFailuresState] = useState(() => demoTools.getNetworkFailureRate() > 0);

  return {
    isAvailable: demoTools.isAvailable,
    simulationEnabled,
    setSimulationEnabled: (enabled) => {
      void settingsStore.setSimulationEnabled(enabled);
    },
    networkFailuresEnabled,
    setNetworkFailuresEnabled: (enabled) => {
      demoTools.setNetworkFailureRate(enabled ? SIMULATED_FAILURE_RATE : 0);
      setNetworkFailuresState(enabled);
    },
    resetDemoData: async () => {
      await demoTools.resetDemoData();
      demoTools.setSimulationEnabled(settingsStore.getState().simulationEnabled);
      // Drop every cached server response. `resetQueries` (rather than `clear`) also re-renders
      // and refetches the screens that are currently mounted instead of leaving them detached.
      queryClient.getMutationCache().clear();
      await queryClient.resetQueries();
    },
  };
}
