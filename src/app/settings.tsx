import { View } from 'react-native';

import { CenteredNote } from '@/components/placeholder-screen';
import { colors } from '@/constants/theme';

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <CenteredNote />
    </View>
  );
}
