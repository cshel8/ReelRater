import NetInfo from '@react-native-community/netinfo';
import type { ConnectivityService } from '@/services/contracts';

export const netInfoConnectivityService: ConnectivityService = {
  async isOnline() {
    const state = await NetInfo.fetch();
    return (
      state.isConnected !== false && state.isInternetReachable !== false
    );
  },
};
