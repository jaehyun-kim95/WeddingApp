import { View } from 'react-native';

import { CenteredNote } from '@/components/placeholder-screen';
import { colors } from '@/constants/theme';

export default function GuestsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground }}>
      <CenteredNote />
    </View>
  );
}
